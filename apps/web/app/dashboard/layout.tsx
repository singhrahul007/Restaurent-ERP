"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { AppFrame, AppShell, Badge, Sidebar, SidebarItem, Topbar } from "@niva/ui";
import {
  Bike,
  Flame,
  Home,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { SessionGate } from "../../lib/session-gate";
import { getCachedMe } from "../../lib/session";
import { UserMenu, SidebarUserFooter } from "../../components/user-menu";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const me = getCachedMe();
  const isAdmin = me?.user?.isPlatformAdmin || me?.memberships?.some(m => m.roles.includes("SUPER_ADMIN"));

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
              start={
                <div className="flex items-center gap-3">
                  <Link
                    href="/"
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-fg-secondary hover:text-fg-primary transition-colors"
                  >
                    <Home className="size-3.5" />
                    Hub
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-fg-muted font-medium">Branch:</span>
                    <span className="rounded-md border border-border bg-elevated px-2 py-0.5 text-xs font-semibold text-fg-primary">
                      Main Kitchen & Dine-In
                    </span>
                  </div>
                </div>
              }
              end={
                <div className="flex items-center gap-3">
                  <Badge variant="success" dot pulse size="sm">
                    Live
                  </Badge>
                  <Link
                    href="/pos"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent-hover transition-colors"
                  >
                    <UtensilsCrossed className="size-3.5" />
                    Open POS
                  </Link>
                  <UserMenu />
                </div>
              }
            />
          }
          sidebar={
            <Sidebar
              footer={
                <div className="space-y-2">
                  <SidebarUserFooter />
                  <div className="flex items-center justify-between text-[11px] text-fg-muted px-1">
                    <span>v2.4.0 High-Volume</span>
                    <span className="flex size-2 rounded-full bg-emerald-400" />
                  </div>
                </div>
              }
            >
              <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                Intelligence
              </div>
              <Link href="/">
                <SidebarItem
                  active={pathname === "/"}
                  icon={<Home className="size-4" />}
                >
                  Home Hub
                </SidebarItem>
              </Link>
              <Link href="/dashboard">
                <SidebarItem
                  active={pathname === "/dashboard"}
                  icon={<LayoutDashboard className="size-4" />}
                >
                  Analytics & P&L
                </SidebarItem>
              </Link>
              <Link href="/ops">
                <SidebarItem
                  active={pathname === "/ops"}
                  icon={<Zap className="size-4" />}
                  badge={<Badge variant="primary" size="sm">Live</Badge>}
                >
                  Manager Ops
                </SidebarItem>
              </Link>

              <div className="mt-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                Operations
              </div>
              <Link href="/pos">
                <SidebarItem
                  active={pathname === "/pos"}
                  icon={<UtensilsCrossed className="size-4" />}
                >
                  POS Register
                </SidebarItem>
              </Link>
              <Link href="/queue">
                <SidebarItem
                  active={pathname === "/queue"}
                  icon={<Users className="size-4" />}
                  badge={<Badge variant="purple" size="sm">Tokens</Badge>}
                >
                  Queue & Waitlist
                </SidebarItem>
              </Link>
              <Link href="/kds">
                <SidebarItem
                  active={pathname === "/kds"}
                  icon={<Flame className="size-4" />}
                >
                  Kitchen KDS
                </SidebarItem>
              </Link>
              <Link href="/driver">
                <SidebarItem
                  active={pathname.startsWith("/driver")}
                  icon={<Bike className="size-4" />}
                >
                  Rider Fleet
                </SidebarItem>
              </Link>

              <div className="mt-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                Configuration
              </div>
              <Link href="/setup/restaurant">
                <SidebarItem
                  active={pathname.startsWith("/setup")}
                  icon={<Settings className="size-4" />}
                >
                  Store Setup
                </SidebarItem>
              </Link>

              {isAdmin && (
                <>
                  <div className="mt-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-amber-500/90 flex items-center gap-1.5">
                    <span>Admin Control</span>
                    <Badge variant="purple" size="sm">Root</Badge>
                  </div>
                  <Link href="/dashboard/access-control">
                    <SidebarItem
                      active={pathname.startsWith("/dashboard/access-control")}
                      icon={<ShieldCheck className="size-4 text-amber-500" />}
                    >
                      Access & Roles Studio
                    </SidebarItem>
                  </Link>
                </>
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
