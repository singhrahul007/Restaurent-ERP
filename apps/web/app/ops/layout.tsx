"use client";

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
            <Topbar brand="Niva" start={<span className="text-sm text-fg-muted">Floor ops</span>} />
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
