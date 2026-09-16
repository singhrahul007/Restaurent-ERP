"use client";

import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { AppFrame, AppShell, Sidebar, SidebarItem, Topbar } from "@niva/ui";
import { SessionGate } from "../../lib/session-gate";

export default function SetupLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <SessionGate>
      <AppShell shell="owner">
        <AppFrame
          topbar={
            <Topbar brand="Niva" start={<span className="text-sm text-fg-muted">Setup</span>} />
          }
          sidebar={
            <Sidebar>
              <SidebarItem href="/dashboard" active={pathname === "/dashboard"}>
                Dashboard
              </SidebarItem>
              <SidebarItem href="/setup/restaurant" active={pathname.startsWith("/setup/restaurant")}>
                Restaurant
              </SidebarItem>
              <SidebarItem href="/setup/branches" active={pathname.startsWith("/setup/branches")}>
                Branches
              </SidebarItem>
              <SidebarItem href="/setup/tables" active={pathname.startsWith("/setup/tables")}>
                Tables
              </SidebarItem>
              <SidebarItem href="/setup/staff" active={pathname.startsWith("/setup/staff")}>
                Staff
              </SidebarItem>
              <SidebarItem href="/setup/menu" active={pathname.startsWith("/setup/menu")}>
                Menu
              </SidebarItem>
              <SidebarItem href="/setup/inventory" active={pathname.startsWith("/setup/inventory")}>
                Inventory
              </SidebarItem>
              <SidebarItem href="/setup/suppliers" active={pathname.startsWith("/setup/suppliers")}>
                Suppliers
              </SidebarItem>
              <SidebarItem href="/setup/recipes" active={pathname.startsWith("/setup/recipes")}>
                Recipes
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
