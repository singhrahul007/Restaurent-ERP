"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import {
  AppFrame,
  AppShell,
  Sidebar,
  SidebarItem,
  Topbar,
} from "@niva/ui";
import { ApiError, api } from "../../lib/api";

export default function SetupLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api("/auth/me")
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
          return;
        }
        if (!cancelled) {
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <AppShell>
        <p className="p-6 text-fg-muted">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell shell="owner">
      <AppFrame
        topbar={<Topbar brand="Niva" start={<span className="text-sm text-fg-muted">Setup</span>} />}
        sidebar={
          <Sidebar>
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
            <Link href="/" className="mt-4 px-3 text-sm text-fg-muted">
              Home
            </Link>
          </Sidebar>
        }
      >
        {children}
      </AppFrame>
    </AppShell>
  );
}
