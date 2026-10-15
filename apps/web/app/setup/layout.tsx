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
              <Link href="/dashboard">
                <SidebarItem active={pathname === "/dashboard"}>
                  Dashboard
                </SidebarItem>
              </Link>
              <Link href="/setup/restaurant">
                <SidebarItem active={pathname.startsWith("/setup/restaurant")}>
                  Restaurant
                </SidebarItem>
              </Link>
              <Link href="/setup/branches">
                <SidebarItem active={pathname.startsWith("/setup/branches")}>
                  Branches
                </SidebarItem>
              </Link>
              <Link href="/setup/tables">
                <SidebarItem active={pathname.startsWith("/setup/tables")}>
                  Tables
                </SidebarItem>
              </Link>
              <Link href="/setup/staff">
                <SidebarItem active={pathname.startsWith("/setup/staff")}>
                  Staff
                </SidebarItem>
              </Link>
              <Link href="/setup/menu">
                <SidebarItem active={pathname.startsWith("/setup/menu")}>
                  Menu
                </SidebarItem>
              </Link>
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
              <Link href="/setup/ondc">
                <SidebarItem active={pathname.startsWith("/setup/ondc")}>
                  ONDC Channel
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
