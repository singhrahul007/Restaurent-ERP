import { randomUUID } from "node:crypto";
import {
  generateNumericOtp,
  generateOpaqueToken,
  hashOpaqueToken,
  hashOtp,
  hashPassword,
  OTP_TTL_MS,
  verifyPasswordAgainstKnownOrDummy,
} from "@niva/auth";
import type { ApiEnv } from "@niva/config";
import type {
  ForgotPasswordBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
} from "@niva/validation";
import { AppError, isUniqueViolation } from "../../lib/errors.js";
import { REFRESH_MAX_AGE_SECONDS, signAccessToken } from "./auth.cookies.js";
import type { AuthRepository } from "./auth.repository.js";

const LOGIN_FAILED_MESSAGE = "Invalid email or password";
const REFRESH_FAILED_MESSAGE = "Invalid refresh token";
const RESET_TTL_MS = 60 * 60 * 1000;

export type LoginContext = {
  ip?: string;
  userAgent?: string;
  device?: string;
};

export type AuthLog = {
  info: (bindings: Record<string, unknown>, message: string) => void;
};

export function createAuthService(
  repository: AuthRepository,
  env: ApiEnv,
  log?: AuthLog,
) {
  return {
    async register(input: RegisterBody) {
      try {
        const passwordHash = await hashPassword(input.password);
        const user = await repository.insertUser({
          email: input.email,
          passwordHash,
          phone: input.phone,
        });
        await issueEmailVerification(repository, env, user, log);
        return user;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError("CONFLICT", "Email already registered", 409);
        }
        throw error;
      }
    },

    async login(input: LoginBody, context: LoginContext) {
      const user = await repository.findUserByEmail(input.email);
      const passwordOk = await verifyPasswordAgainstKnownOrDummy(
        user?.passwordHash,
        input.password,
      );
      if (!user || !passwordOk || user.status === "DISABLED") {
        throw new AppError("UNAUTHORIZED", LOGIN_FAILED_MESSAGE, 401);
      }

      const refreshToken = generateOpaqueToken();
      const familyId = randomUUID();
      await repository.insertSession({
        userId: user.id,
        familyId,
        tokenHash: hashOpaqueToken(refreshToken),
        device: context.device,
        userAgent: context.userAgent,
        ip: context.ip,
        expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_SECONDS * 1000),
      });

      await repository.writeAudit({
        actorId: user.id,
        action: "LOGIN",
        resourceType: "user",
        resourceId: user.id,
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { email: user.email },
      });

      const accessToken = await signAccessToken(env, user.id);
      return {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, status: user.status },
      };
    },

    async refresh(refreshToken: string | undefined, context: LoginContext) {
      if (!refreshToken) {
        throw new AppError("UNAUTHORIZED", REFRESH_FAILED_MESSAGE, 401);
      }

      const session = await repository.findSessionByTokenHash(
        hashOpaqueToken(refreshToken),
      );
      if (!session) {
        throw new AppError("UNAUTHORIZED", REFRESH_FAILED_MESSAGE, 401);
      }

      if (session.revokedAt) {
        await repository.revokeFamilySessions(session.familyId);
        await repository.writeAudit({
          actorId: session.userId,
          action: "REFRESH_REUSE",
          ip: context.ip,
          userAgent: context.userAgent,
          metadata: { familyId: session.familyId },
        });
        throw new AppError("UNAUTHORIZED", REFRESH_FAILED_MESSAGE, 401);
      }

      if (session.expiresAt.getTime() <= Date.now()) {
        throw new AppError("UNAUTHORIZED", REFRESH_FAILED_MESSAGE, 401);
      }

      const user = await repository.findUserById(session.userId);
      if (!user || user.status === "DISABLED") {
        await repository.revokeFamilySessions(session.familyId);
        throw new AppError("UNAUTHORIZED", REFRESH_FAILED_MESSAGE, 401);
      }

      const consumed = await repository.revokeSessionIfActive(session.id);
      if (!consumed) {
        await repository.revokeFamilySessions(session.familyId);
        await repository.writeAudit({
          actorId: session.userId,
          action: "REFRESH_REUSE",
          ip: context.ip,
          userAgent: context.userAgent,
          metadata: { familyId: session.familyId },
        });
        throw new AppError("UNAUTHORIZED", REFRESH_FAILED_MESSAGE, 401);
      }

      const nextRefreshToken = generateOpaqueToken();
      await repository.insertSession({
        userId: user.id,
        familyId: session.familyId,
        tokenHash: hashOpaqueToken(nextRefreshToken),
        device: context.device ?? session.device ?? undefined,
        userAgent: context.userAgent ?? session.userAgent ?? undefined,
        ip: context.ip ?? session.ip ?? undefined,
        expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_SECONDS * 1000),
      });

      const accessToken = await signAccessToken(env, user.id);
      return {
        accessToken,
        refreshToken: nextRefreshToken,
        user: { id: user.id, email: user.email, status: user.status },
      };
    },

    async logout(refreshToken: string | undefined, context: LoginContext) {
      if (!refreshToken) {
        return { loggedOut: false as const };
      }

      const session = await repository.findSessionByTokenHash(
        hashOpaqueToken(refreshToken),
      );
      if (!session || session.revokedAt) {
        return { loggedOut: false as const };
      }

      await repository.revokeSessionIfActive(session.id);
      await repository.writeAudit({
        actorId: session.userId,
        action: "LOGOUT",
        resourceType: "user",
        resourceId: session.userId,
        ip: context.ip,
        userAgent: context.userAgent,
      });
      return { loggedOut: true as const };
    },

    async logoutAll(refreshToken: string | undefined, context: LoginContext) {
      if (!refreshToken) {
        return { loggedOut: false as const };
      }

      const session = await repository.findSessionByTokenHash(
        hashOpaqueToken(refreshToken),
      );
      if (!session) {
        return { loggedOut: false as const };
      }

      await repository.revokeUserSessions(session.userId);
      await repository.writeAudit({
        actorId: session.userId,
        action: "LOGOUT_ALL",
        resourceType: "user",
        resourceId: session.userId,
        ip: context.ip,
        userAgent: context.userAgent,
      });
      return { loggedOut: true as const };
    },

    async forgotPassword(input: ForgotPasswordBody) {
      const user = await repository.findUserByEmail(input.email);
      if (!user || user.status === "DISABLED") {
        return { issued: false as const };
      }

      await repository.invalidateUnusedPasswordResets(user.id);
      const token = generateOpaqueToken();
      await repository.insertPasswordReset({
        userId: user.id,
        tokenHash: hashOpaqueToken(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      });

      await repository.writeAudit({
        actorId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        resourceType: "user",
        resourceId: user.id,
        metadata: { email: user.email },
      });

      return {
        issued: true as const,
        resetToken: env.NODE_ENV === "production" ? undefined : token,
      };
    },

    async resetPassword(input: ResetPasswordBody) {
      const tokenHash = hashOpaqueToken(input.token);
      const reset = await repository.findValidPasswordReset(tokenHash);
      if (!reset) {
        throw new AppError("INVALID_RESET_TOKEN", "Reset token is invalid", 400);
      }

      const passwordHash = await hashPassword(input.password);
      await repository.updatePasswordHash(reset.userId, passwordHash);
      await repository.consumePasswordReset(reset.id);
      await repository.revokeUserSessions(reset.userId);
      await repository.writeAudit({
        actorId: reset.userId,
        action: "PASSWORD_CHANGED",
        resourceType: "user",
        resourceId: reset.userId,
        metadata: { via: "reset" },
      });
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

async function issueEmailVerification(
  repository: AuthRepository,
  env: ApiEnv,
  user: { id: string; email: string },
  log?: AuthLog,
) {
  const otp = generateNumericOtp();
  const codeHash = hashOtp(otp, env.JWT_ACCESS_SECRET, user.id);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await repository.invalidateUnusedEmailVerifications(user.id);
  await repository.insertEmailVerification({
    userId: user.id,
    email: user.email,
    codeHash,
    expiresAt,
  });
  await repository.insertOtpChallenge({
    userId: user.id,
    destination: user.email,
    channel: "EMAIL",
    purpose: "EMAIL_VERIFICATION",
    codeHash,
    expiresAt,
  });
  logOtpIssued(env, log, {
    destination: user.email,
    purpose: "EMAIL_VERIFICATION",
    otp,
  });
}

function logOtpIssued(
  env: ApiEnv,
  log: AuthLog | undefined,
  payload: { destination: string; purpose: string; otp: string },
) {
  if (!log) {
    return;
  }
  if (env.NODE_ENV === "production") {
    log.info(
      { destination: payload.destination, purpose: payload.purpose },
      "otp issued; provider send deferred",
    );
    return;
  }
  log.info(
    {
      destination: payload.destination,
      purpose: payload.purpose,
      otp: payload.otp,
    },
    "otp issued (dev, not sent)",
  );
}
