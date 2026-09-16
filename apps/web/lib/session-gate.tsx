"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { AppShell } from "@niva/ui";
import { hasCachedSession, isUnauthorized, loadSession } from "../lib/session";

export function useRequireSession() {
  const router = useRouter();
  const [ready, setReady] = useState(hasCachedSession);

  useEffect(() => {
    let cancelled = false;
    loadSession()
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch((error) => {
        if (isUnauthorized(error)) {
          router.replace("/login");
          return;
        }
        if (!cancelled) {
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return ready;
}

export function SessionGate({ children }: { children: ReactNode }) {
  const ready = useRequireSession();
  if (!ready) {
    return (
      <AppShell>
        <p className="p-6 text-fg-muted">Loading…</p>
      </AppShell>
    );
  }
  return children;
}
