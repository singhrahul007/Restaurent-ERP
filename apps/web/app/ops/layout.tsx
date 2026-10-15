"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { AppFrame, AppShell, Sidebar, SidebarItem, Topbar } from "@niva/ui";
import { SessionGate } from "../../lib/session-gate";

export default function OpsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <SessionGate>
      <AppShell shell="kds">
        <AppFrame
          topbar={
            <Topbar
              brand={
                <Link href="/" className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo.png"
                    alt="MR.Genious"
                    className="h-8 w-auto max-w-[120px] object-contain"
                  />
                  <span className="font-display text-base font-bold tracking-tight">MR.Genious</span>
                </Link>
              }
              start={<span className="text-sm text-fg-muted">Floor ops</span>}
            />
          }
          sidebar={
            <Sidebar>
              <SidebarItem href="/ops" active={pathname === "/ops"}>
                Live board
              </SidebarItem>
              <SidebarItem href="/kds" active={pathname.startsWith("/kds")}>
                Kitchen
              </SidebarItem>
              <SidebarItem href="/pos" active={pathname.startsWith("/pos")}>
                POS
              </SidebarItem>
              <SidebarItem href="/dashboard" active={pathname === "/dashboard"}>
                Owner dashboard
              </SidebarItem>
            </Sidebar>
          }
        >
          {children}
        </AppFrame>
      </AppShell>
    </SessionGate>
  );
}
