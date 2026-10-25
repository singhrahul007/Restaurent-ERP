"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { AppFrame, AppShell, Sidebar, SidebarItem, Topbar } from "@niva/ui";
import { Home } from "lucide-react";
import { UserMenu, SidebarUserFooter } from "../../components/user-menu";
import { SessionGate } from "../../lib/session-gate";
import {
  getCachedMe,
  hasAnyPermission,
  hasPermission,
  isPlatformAdmin,
  loadSession,
  type Me,
} from "../../lib/session";

export default function SetupLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(getCachedMe);

  useEffect(() => {
    if (!me) {
      loadSession().then(setMe).catch(() => {});
    }
  }, [me]);

  const canReports = hasPermission("reports.view");
  const canRestaurant = hasAnyPermission(["restaurant.view", "restaurant.manage"]);
  const canBranches = hasAnyPermission(["branch.view", "branch.manage"]);
  const canTables = hasAnyPermission(["tables.view", "tables.manage"]);
  const canStaff = hasAnyPermission(["staff.view", "staff.manage"]);
  const canMenu = hasAnyPermission(["menu.view", "menu.manage"]);
  const canInventory = hasAnyPermission(["inventory.view", "inventory.manage"]);
  const canOndc = hasAnyPermission(["settings.view", "settings.manage"]);

  return (
    <SessionGate requiredAnyPermissions={["restaurant.view", "restaurant.manage", "branch.view", "branch.manage", "staff.view", "menu.view", "inventory.view"]}>
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
              start={
                <div className="flex items-center gap-3">
                  <Link
                    href="/"
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-fg-secondary hover:text-fg-primary transition-colors"
                  >
                    <Home className="size-3.5" />
                    Hub
                  </Link>
                  <span className="text-sm font-medium text-fg-muted">Setup & Settings</span>
                </div>
              }
              end={<UserMenu />}
            />
          }
          sidebar={
            <Sidebar footer={<SidebarUserFooter />}>
              <Link href="/">
                <SidebarItem active={pathname === "/"}>
                  Home Hub
                </SidebarItem>
              </Link>
              {canReports && (
                <Link href="/dashboard">
                  <SidebarItem active={pathname === "/dashboard"}>
                    Dashboard
                  </SidebarItem>
                </Link>
              )}
              {canRestaurant && (
                <Link href="/setup/restaurant">
                  <SidebarItem active={pathname.startsWith("/setup/restaurant")}>
                    Restaurant
                  </SidebarItem>
                </Link>
              )}
              {canBranches && (
                <Link href="/setup/branches">
                  <SidebarItem active={pathname.startsWith("/setup/branches")}>
                    Branches
                  </SidebarItem>
                </Link>
              )}
              {canTables && (
                <Link href="/setup/tables">
                  <SidebarItem active={pathname.startsWith("/setup/tables")}>
                    Tables
                  </SidebarItem>
                </Link>
              )}
              {canStaff && (
                <Link href="/setup/staff">
                  <SidebarItem active={pathname.startsWith("/setup/staff")}>
                    Staff
                  </SidebarItem>
                </Link>
              )}
              {canMenu && (
                <Link href="/setup/menu">
                  <SidebarItem active={pathname.startsWith("/setup/menu")}>
                    Menu
                  </SidebarItem>
                </Link>
              )}
              {canInventory && (
                <>
                  <Link href="/setup/inventory">
                    <SidebarItem active={pathname.startsWith("/setup/inventory")}>
                      Inventory
                    </SidebarItem>
                  </Link>
                  <Link href="/setup/suppliers">
                    <SidebarItem active={pathname.startsWith("/setup/suppliers")}>
                      Suppliers
                    </SidebarItem>
                  </Link>
                  <Link href="/setup/recipes">
                    <SidebarItem active={pathname.startsWith("/setup/recipes")}>
                      Recipes
                    </SidebarItem>
                  </Link>
                </>
              )}
              {canOndc && (
                <Link href="/setup/ondc">
                  <SidebarItem active={pathname.startsWith("/setup/ondc")}>
                    ONDC Channel
                  </SidebarItem>
                </Link>
              )}
            </Sidebar>
          }
        >
          {children}
        </AppFrame>
      </AppShell>
    </SessionGate>
  );
}
