"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { AppShell, Button, ErrorState } from "@niva/ui";
import { ApiError } from "./api";
import {
  getCachedMe,
  hasAnyPermission,
  hasPermission,
  isPlatformAdmin,
  isUnauthorized,
  loadSession,
  type Me,
} from "./session";
import { AccessDeniedView } from "./permissions";

export function useSessionGate() {
  const router = useRouter();
  const [ready, setReady] = useState(() => Boolean(getCachedMe()));
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [me, setMe] = useState<Me | null>(getCachedMe);

  const check = useCallback(() => {
    setError(null);
    let cancelled = false;

    loadSession()
      .then((session) => {
        if (!cancelled) {
          setMe(session);
          setReady(true);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (isUnauthorized(err)) {
          setIsRedirecting(true);
          router.replace("/login");
          return;
        }
        setError(
          err instanceof ApiError
            ? err.message
            : "Cannot reach the API. Start it with pnpm dev:api (port 3001).",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    return check();
  }, [check]);

  return { ready, error, isRedirecting, retry: check, me };
}

export function useRequireSession() {
  const { ready } = useSessionGate();
  return ready;
}

export interface SessionGateProps {
  children: ReactNode;
  /** Require a specific permission to view this route/layout */
  requiredPermission?: string;
  /** Require at least one of these permissions */
  requiredAnyPermissions?: string[];
  /** Require Master/Platform Admin */
  requirePlatformAdmin?: boolean;
}

export function SessionGate({
  children,
  requiredPermission,
  requiredAnyPermissions,
  requirePlatformAdmin: needsPlatformAdmin,
}: SessionGateProps) {
  const { ready, error, isRedirecting, retry, me } = useSessionGate();

  if (isRedirecting) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-sm text-fg-muted">Redirecting to login…</p>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/login">Go to Login</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg p-6 pt-16">
          <ErrorState
            title="Backend Service Unavailable"
            description={error}
            onRetry={retry}
          />
        </div>
      </AppShell>
    );
  }

  if (!ready || !me) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[50vh] gap-2.5 p-6 text-sm text-fg-muted">
          <span className="inline-block size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span>Verifying access…</span>
        </div>
      </AppShell>
    );
  }

  // Permission guard
  if (needsPlatformAdmin && !isPlatformAdmin()) {
    return (
      <AppShell>
        <AccessDeniedView
          title="Master Admin Required"
          description="This section is restricted to Platform / Master Administrators."
        />
      </AppShell>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <AppShell>
        <AccessDeniedView requiredPermission={requiredPermission} />
      </AppShell>
    );
  }

  if (
    requiredAnyPermissions &&
    requiredAnyPermissions.length > 0 &&
    !hasAnyPermission(requiredAnyPermissions)
  ) {
    return (
      <AppShell>
        <AccessDeniedView
          description={`You do not have any of the required permissions (${requiredAnyPermissions.join(
            ", ",
          )}) to access this screen.`}
        />
      </AppShell>
    );
  }

  return <>{children}</>;
}
