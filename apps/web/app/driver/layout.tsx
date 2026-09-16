"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { AppShell, ErrorState, Skeleton } from "@niva/ui";
import { ApiError, api } from "../../lib/api";

export default function DriverLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api("/auth/me")
      .then((me: { memberships: Array<{ organizationId: string }> }) => {
        const organizationId = me.memberships[0]?.organizationId;
        if (organizationId) {
          window.localStorage.setItem("niva_organization_id", organizationId);
        }
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch((caught) => {
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
          return;
        }
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : "Could not load driver");
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <AppShell shell="driver">
        <Skeleton className="m-4 h-48" />
      </AppShell>
    );
  }
  if (error) {
    return (
      <AppShell shell="driver">
        <ErrorState description={error} />
      </AppShell>
    );
  }

  return (
    <AppShell shell="driver" className="pb-20">
      {children}
      <nav className="fixed bottom-0 inset-x-0 flex border-t border-border bg-elevated">
        <Link className="flex-1 py-4 text-center text-sm font-medium" href="/driver">
          Jobs
        </Link>
        <Link className="flex-1 py-4 text-center text-sm font-medium" href="/driver">
          Shift
        </Link>
      </nav>
    </AppShell>
  );
}
