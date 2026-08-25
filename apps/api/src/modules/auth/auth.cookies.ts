import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import type { ApiEnv } from "@niva/config";

export const ACCESS_COOKIE = "niva_access";
export const REFRESH_COOKIE = "niva_refresh";
export const ORGANIZATION_COOKIE = "niva_organization";
export const ACCESS_MAX_AGE_SECONDS = 15 * 60;
export const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function cookieSecure(env: ApiEnv): boolean {
  if (env.COOKIE_SECURE === "true") {
    return true;
  }
  if (env.COOKIE_SECURE === "false") {
    return false;
  }
  return env.NODE_ENV === "production";
}

export function accessCookieOptions(env: ApiEnv) {
  return {
    httpOnly: true,
    secure: cookieSecure(env),
    sameSite: "lax" as const,
    path: "/",
    maxAge: ACCESS_MAX_AGE_SECONDS,
  };
}

export function refreshCookieOptions(env: ApiEnv) {
  return {
    httpOnly: true,
    secure: cookieSecure(env),
    sameSite: "lax" as const,
    path: "/api/v1/auth",
    maxAge: REFRESH_MAX_AGE_SECONDS,
  };
}

export function expiredAccessCookieOptions(env: ApiEnv) {
  return { ...accessCookieOptions(env), maxAge: 0 };
}

export function expiredRefreshCookieOptions(env: ApiEnv) {
  return { ...refreshCookieOptions(env), maxAge: 0 };
}

export function organizationCookieOptions(env: ApiEnv) {
  return {
    httpOnly: true,
    secure: cookieSecure(env),
    sameSite: "lax" as const,
    path: "/",
    maxAge: REFRESH_MAX_AGE_SECONDS,
  };
}

export async function signAccessToken(
  env: ApiEnv,
  userId: string,
  expiresIn: string | number = `${ACCESS_MAX_AGE_SECONDS}s`,
  issuedAt?: number,
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  const jwt = new SignJWT({ sub: userId }).setProtectedHeader({ alg: "HS256" });
  if (issuedAt === undefined) {
    jwt.setIssuedAt();
  } else {
    jwt.setIssuedAt(issuedAt);
  }
  return jwt.setExpirationTime(expiresIn).sign(secret);
}

export type AccessTokenVerifyResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "missing" | "expired" | "invalid" };

export async function verifyAccessToken(
  env: ApiEnv,
  token: string | undefined,
): Promise<AccessTokenVerifyResult> {
  if (!token) {
    return { ok: false, reason: "missing" };
  }

  try {
    const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, userId: payload.sub };
  } catch (error) {
    if (error instanceof joseErrors.JWTExpired) {
      return { ok: false, reason: "expired" };
    }
    return { ok: false, reason: "invalid" };
  }
}
