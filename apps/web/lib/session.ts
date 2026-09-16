import { ApiError, api } from "./api";

type Me = {
  memberships: Array<{ organizationId: string }>;
};

let inflight: Promise<Me> | null = null;
let sessionReady = false;

export function hasCachedSession(): boolean {
  return sessionReady;
}

export function clearCachedSession(): void {
  inflight = null;
  sessionReady = false;
}

export function loadSession(): Promise<Me> {
  if (!inflight) {
    inflight = api<Me>("/auth/me").then((me) => {
      sessionReady = true;
      const organizationId = me.memberships[0]?.organizationId;
      if (organizationId && typeof window !== "undefined") {
        window.localStorage.setItem("niva_organization_id", organizationId);
      }
      return me;
    });
  }
  return inflight;
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
