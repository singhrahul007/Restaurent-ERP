"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { AppShell, Skeleton } from "@niva/ui";
import { useRequireSession } from "../../lib/session-gate";

export default function DriverLayout({ children }: { children: ReactNode }) {
  const ready = useRequireSession();

  if (!ready) {
    return (
      <AppShell shell="driver">
        <Skeleton className="m-4 h-48" />
      </AppShell>
    );
  }

  return (
    <AppShell shell="driver" className="pb-20">
      {children}
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-elevated">
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
