"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { AppFrame, AppShell, Sidebar, SidebarItem, Topbar } from "@niva/ui";
import { SessionGate } from "../../lib/session-gate";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <SessionGate>
      <AppShell shell="owner">
        <AppFrame
          topbar={
            <Topbar brand="Niva" start={<span className="text-sm text-fg-muted">Owner</span>} />
          }
          sidebar={
            <Sidebar>
              <SidebarItem href="/dashboard" active={pathname === "/dashboard"}>
                Overview
              </SidebarItem>
              <SidebarItem href="/setup/restaurant" active={pathname.startsWith("/setup")}>
                Setup
              </SidebarItem>
              <SidebarItem href="/ops" active={pathname === "/ops"}>
                Manager ops
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
