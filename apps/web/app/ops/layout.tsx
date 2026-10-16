"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { AppFrame, AppShell, Sidebar, SidebarItem, Topbar } from "@niva/ui";
import { Home, LayoutDashboard, UtensilsCrossed, Zap, Flame } from "lucide-react";
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
              start={
                <div className="flex items-center gap-3">
                  <Link
                    href="/"
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-fg-secondary hover:text-fg-primary transition-colors"
                  >
                    <Home className="size-3.5" />
                    Hub
                  </Link>
                  <span className="text-sm text-fg-muted font-medium">Floor ops</span>
                </div>
              }
              end={<UserMenu />}
            />
          }
          sidebar={
            <Sidebar footer={<SidebarUserFooter />}>
              <Link href="/">
                <SidebarItem active={pathname === "/"} icon={<Home className="size-4" />}>
                  Home Hub
                </SidebarItem>
              </Link>
              <Link href="/ops">
                <SidebarItem active={pathname === "/ops"} icon={<Zap className="size-4" />}>
                  Live board
                </SidebarItem>
              </Link>
              <Link href="/kds">
                <SidebarItem active={pathname.startsWith("/kds")} icon={<Flame className="size-4" />}>
                  Kitchen
                </SidebarItem>
              </Link>
              <Link href="/pos">
                <SidebarItem active={pathname.startsWith("/pos")} icon={<UtensilsCrossed className="size-4" />}>
                  POS
                </SidebarItem>
              </Link>
              <Link href="/dashboard">
                <SidebarItem active={pathname === "/dashboard"} icon={<LayoutDashboard className="size-4" />}>
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
