import type { FastifyPluginAsync, FastifyReply } from "fastify";
import "@fastify/cookie";
import type { ApiEnv } from "@niva/config";
import type { Database } from "@niva/database";
import {
  forgotPasswordBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
} from "@niva/validation";
import { errorEnvelope } from "../../lib/envelope.js";
import { AppError } from "../../lib/errors.js";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  expiredAccessCookieOptions,
  expiredRefreshCookieOptions,
  refreshCookieOptions,
} from "./auth.cookies.js";
import { createAuthRepository } from "./auth.repository.js";
import { createAuthService } from "./auth.service.js";
import { createRequireAuth } from "./auth.middleware.js";
import { createTenancyRepository } from "../tenancy/tenancy.repository.js";
import { attachOptionalTenant } from "../../lib/tenant-context.js";
import {
  forgotPasswordSchema,
  loginSchema,
  logoutAllSchema,
  logoutSchema,
  meSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from "./auth.openapi.js";

const authRateLimit = { max: 5, timeWindow: "1 minute" as const };

function setAuthCookies(
  reply: FastifyReply,
  env: ApiEnv,
  tokens: { accessToken: string; refreshToken: string },
) {
  reply.setCookie(ACCESS_COOKIE, tokens.accessToken, accessCookieOptions(env));
  reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions(env));
}

function clearAuthCookies(reply: FastifyReply, env: ApiEnv) {
  reply.setCookie(ACCESS_COOKIE, "", expiredAccessCookieOptions(env));
  reply.setCookie(REFRESH_COOKIE, "", expiredRefreshCookieOptions(env));
}

export const authRoutes: FastifyPluginAsync<{ db: Database; env: ApiEnv }> = async (
  app,
  opts,
) => {
  const repository = createAuthRepository(opts.db);
  const tenancy = createTenancyRepository(opts.db);
  const service = createAuthService(repository, opts.env, app.log);
  const requireAuth = createRequireAuth(opts.env, repository, tenancy);

  app.post("/register", { schema: registerSchema }, async (request, reply) => {
    const parsed = registerBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send(errorEnvelope("VALIDATION_ERROR", "Invalid registration payload"));
    }

    try {
      const user = await service.register(parsed.data);
      return reply.status(201).send({
        success: true,
        data: user,
        meta: { requestId: request.id },
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply
          .status(error.statusCode)
          .send(errorEnvelope(error.code, error.message));
      }
      throw error;
    }
  });

  app.post(
    "/login",
    { schema: loginSchema, config: { rateLimit: authRateLimit } },
    async (request, reply) => {
      const parsed = loginBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid login payload"));
      }

      try {
        const result = await service.login(parsed.data, {
          ip: request.ip,
          userAgent: request.headers["user-agent"],
        });
        setAuthCookies(reply, opts.env, result);
        return {
          success: true,
          data: { user: result.user },
          meta: { requestId: request.id },
        };
      } catch (error) {
        if (error instanceof AppError) {
          return reply
            .status(error.statusCode)
            .send(errorEnvelope(error.code, error.message));
        }
        throw error;
      }
    },
  );

  app.post(
    "/refresh",
    { schema: refreshSchema, config: { rateLimit: authRateLimit } },
    async (request, reply) => {
      try {
        const result = await service.refresh(request.cookies[REFRESH_COOKIE], {
          ip: request.ip,
          userAgent: request.headers["user-agent"],
        });
        setAuthCookies(reply, opts.env, result);
        return {
          success: true,
          data: { ok: true },
          meta: { requestId: request.id },
        };
      } catch (error) {
        if (error instanceof AppError) {
          clearAuthCookies(reply, opts.env);
          return reply
            .status(error.statusCode)
            .send(errorEnvelope(error.code, error.message));
        }
        throw error;
      }
    },
  );

  app.post("/logout", { schema: logoutSchema }, async (request, reply) => {
    await service.logout(request.cookies[REFRESH_COOKIE], {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    clearAuthCookies(reply, opts.env);
    return {
      success: true,
      data: { ok: true },
      meta: { requestId: request.id },
    };
  });

  app.post("/logout-all", { schema: logoutAllSchema }, async (request, reply) => {
    await service.logoutAll(request.cookies[REFRESH_COOKIE], {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    clearAuthCookies(reply, opts.env);
    return {
      success: true,
      data: { ok: true },
      meta: { requestId: request.id },
    };
  });

  app.post(
    "/forgot-password",
    { schema: forgotPasswordSchema, config: { rateLimit: authRateLimit } },
    async (request, reply) => {
      const parsed = forgotPasswordBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid payload"));
      }

      const result = await service.forgotPassword(parsed.data);
      return {
        success: true,
        data: {
          ok: true,
          ...(result.resetToken ? { resetToken: result.resetToken } : {}),
        },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/reset-password",
    { schema: resetPasswordSchema, config: { rateLimit: authRateLimit } },
    async (request, reply) => {
      const parsed = resetPasswordBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid payload"));
      }

      try {
        await service.resetPassword(parsed.data);
        return {
          success: true,
          data: { ok: true },
          meta: { requestId: request.id },
        };
      } catch (error) {
        if (error instanceof AppError) {
          return reply
            .status(error.statusCode)
            .send(errorEnvelope(error.code, error.message));
        }
        throw error;
      }
    },
  );

  app.get("/me", { schema: meSchema, preHandler: requireAuth }, async (request, reply) => {
    const user = request.authUser;
    if (!user) {
      return reply.status(401).send(errorEnvelope("UNAUTHORIZED", "Unauthorized"));
    }
    await attachOptionalTenant(request, tenancy);
    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          status: user.status,
          isPlatformAdmin: user.isPlatformAdmin,
        },
        memberships: request.memberships ?? [],
        permissions: [...(request.permissions ?? [])],
        activeOrganizationId: request.tenant?.organizationId ?? null,
      },
      meta: { requestId: request.id },
    };
  });
};
