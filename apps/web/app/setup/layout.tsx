"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { AppFrame, AppShell, Sidebar, SidebarItem, Topbar } from "@niva/ui";
import { UserMenu, SidebarUserFooter } from "../../components/user-menu";
import { SessionGate } from "../../lib/session-gate";

export default function SetupLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <SessionGate>
      <AppShell shell="owner">
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
              start={<span className="text-sm font-medium text-fg-muted">Setup & Settings</span>}
              end={<UserMenu />}
            />
          }
          sidebar={
            <Sidebar footer={<SidebarUserFooter />}>
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
              <SidebarItem href="/setup/ondc" active={pathname.startsWith("/setup/ondc")}>
                ONDC Channel
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
