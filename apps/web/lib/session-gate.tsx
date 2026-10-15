"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { AppShell, Button, ErrorState } from "@niva/ui";
import { ApiError } from "./api";
import { hasCachedSession, isUnauthorized, loadSession } from "./session";

export function useSessionGate() {
  const router = useRouter();
  const [ready, setReady] = useState(hasCachedSession);
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const check = useCallback(() => {
    setError(null);
    let cancelled = false;

    loadSession()
      .then(() => {
        if (!cancelled) {
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

  return { ready, error, isRedirecting, retry: check };
}

export function useRequireSession() {
  const { ready } = useSessionGate();
  return ready;
}

export function SessionGate({ children }: { children: ReactNode }) {
  const { ready, error, isRedirecting, retry } = useSessionGate();

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

  if (!ready) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 p-6 text-sm text-fg-muted">
          <span className="inline-block size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span>Loading…</span>
        </div>
      </AppShell>
    );
  }

  return children;
}

