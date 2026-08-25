import { and, eq, gt, isNull } from "drizzle-orm";
import {
  emailVerifications,
  otpChallenges,
  passwordResetTokens,
  sessions,
  users,
  writeAudit,
  type Database,
  type WriteAuditInput,
} from "@niva/database";

export type NewUserRecord = {
  email: string;
  passwordHash: string;
  phone?: string;
};

export type NewSessionRecord = {
  userId: string;
  familyId: string;
  tokenHash: string;
  device?: string;
  userAgent?: string;
  ip?: string;
  expiresAt: Date;
};

export function createAuthRepository(db: Database) {
  return {
    async insertUser(input: NewUserRecord) {
      const [row] = await db
        .insert(users)
        .values({
          email: input.email,
          passwordHash: input.passwordHash,
          phone: input.phone,
        })
        .returning({
          id: users.id,
          email: users.email,
          status: users.status,
        });
      if (!row) {
        throw new Error("USER_INSERT_FAILED");
      }
      return row;
    },

    async findIdByEmail(email: string) {
      const [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return row?.id ?? null;
    },

    async findUserByEmail(email: string) {
      const [row] = await db
        .select({
          id: users.id,
          email: users.email,
          status: users.status,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return row ?? null;
    },

    async insertSession(input: NewSessionRecord) {
      const [row] = await db
        .insert(sessions)
        .values({
          userId: input.userId,
          familyId: input.familyId,
          tokenHash: input.tokenHash,
          device: input.device,
          userAgent: input.userAgent,
          ip: input.ip,
          expiresAt: input.expiresAt,
        })
        .returning({ id: sessions.id });
      if (!row) {
        throw new Error("SESSION_INSERT_FAILED");
      }
      return row;
    },

    async findUserById(id: string) {
      const [row] = await db
        .select({
          id: users.id,
          email: users.email,
          status: users.status,
          isPlatformAdmin: users.isPlatformAdmin,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return row ?? null;
    },

    async findSessionByTokenHash(tokenHash: string) {
      const [row] = await db
        .select({
          id: sessions.id,
          userId: sessions.userId,
          familyId: sessions.familyId,
          device: sessions.device,
          userAgent: sessions.userAgent,
          ip: sessions.ip,
          expiresAt: sessions.expiresAt,
          revokedAt: sessions.revokedAt,
        })
        .from(sessions)
        .where(eq(sessions.tokenHash, tokenHash))
        .limit(1);
      return row ?? null;
    },

    async revokeSessionIfActive(id: string) {
      const now = new Date();
      const [row] = await db
        .update(sessions)
        .set({ revokedAt: now })
        .where(and(eq(sessions.id, id), isNull(sessions.revokedAt)))
        .returning({ id: sessions.id });
      return Boolean(row);
    },

    async revokeFamilySessions(familyId: string) {
      await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.familyId, familyId), isNull(sessions.revokedAt)));
    },

    async writeAudit(input: WriteAuditInput) {
      await writeAudit(db, input);
    },

    async invalidateUnusedEmailVerifications(userId: string) {
      await db
        .update(emailVerifications)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(emailVerifications.userId, userId),
            isNull(emailVerifications.consumedAt),
          ),
        );
    },

    async insertEmailVerification(input: {
      userId: string;
      email: string;
      codeHash: string;
      expiresAt: Date;
    }) {
      await db.insert(emailVerifications).values(input);
    },

    async insertOtpChallenge(input: {
      userId?: string;
      destination: string;
      channel: "EMAIL" | "SMS";
      purpose: "EMAIL_VERIFICATION" | "LOGIN" | "STEP_UP";
      codeHash: string;
      expiresAt: Date;
    }) {
      await db.insert(otpChallenges).values({
        userId: input.userId,
        destination: input.destination,
        channel: input.channel,
        purpose: input.purpose,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
      });
    },

    async invalidateUnusedPasswordResets(userId: string) {
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.userId, userId),
            isNull(passwordResetTokens.usedAt),
          ),
        );
    },

    async insertPasswordReset(input: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    }) {
      await db.insert(passwordResetTokens).values(input);
    },

    async findValidPasswordReset(tokenHash: string) {
      const [row] = await db
        .select({
          id: passwordResetTokens.id,
          userId: passwordResetTokens.userId,
        })
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, new Date()),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    async consumePasswordReset(id: string) {
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, id));
    },

    async updatePasswordHash(userId: string, passwordHash: string) {
      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, userId));
    },

    async revokeUserSessions(userId: string) {
      await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    },
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
