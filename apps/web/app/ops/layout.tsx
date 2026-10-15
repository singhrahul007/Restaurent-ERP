"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { AppFrame, AppShell, Sidebar, SidebarItem, Topbar } from "@niva/ui";
import { UserMenu, SidebarUserFooter } from "../../components/user-menu";
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
              end={<UserMenu />}
            />
          }
          sidebar={
            <Sidebar footer={<SidebarUserFooter />}>
              <Link href="/ops">
                <SidebarItem active={pathname === "/ops"}>
                  Live board
                </SidebarItem>
              </Link>
              <Link href="/kds">
                <SidebarItem active={pathname.startsWith("/kds")}>
                  Kitchen
                </SidebarItem>
              </Link>
              <Link href="/pos">
                <SidebarItem active={pathname.startsWith("/pos")}>
                  POS
                </SidebarItem>
              </Link>
              <Link href="/dashboard">
                <SidebarItem active={pathname === "/dashboard"}>
                  Owner dashboard
                </SidebarItem>
              </Link>
            </Sidebar>
          }
        >
          {children}
        </AppFrame>
      </AppShell>
    </SessionGate>
  );
}
