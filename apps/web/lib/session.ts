import { ApiError, api } from "./api";

export type Me = {
  user: {
    id: string;
    email: string;
    status: string;
    isPlatformAdmin: boolean;
  };
  memberships: Array<{
    id: string;
    organizationId: string;
    organizationName: string;
    isOwner: boolean;
    roles: string[];
  }>;
};

let cachedMe: Me | null = null;
let inflight: Promise<Me> | null = null;
let sessionReady = false;

export function getCachedMe(): Me | null {
  return cachedMe;
}

export function hasCachedSession(): boolean {
  return sessionReady;
}

export function clearCachedSession(): void {
  inflight = null;
  cachedMe = null;
  sessionReady = false;
}

export function loadSession(): Promise<Me> {
  if (!inflight) {
    inflight = api<Me>("/auth/me")
      .then((me) => {
        sessionReady = true;
        cachedMe = me;
        const organizationId = me.memberships[0]?.organizationId;
        if (organizationId && typeof window !== "undefined") {
          window.localStorage.setItem("niva_organization_id", organizationId);
        }
        return me;
      })
      .catch((error) => {
        inflight = null;
        cachedMe = null;
        sessionReady = false;
        throw error;
      });
  }
  return inflight;
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export async function logout(): Promise<void> {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    // Ignore network failure so local session is always reset
  }
  clearCachedSession();
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("niva_organization_id");
    window.localStorage.removeItem("niva_restaurant_id");
    window.localStorage.removeItem("niva_branch_id");
    window.location.href = "/login";
  }
}

