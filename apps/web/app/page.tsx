"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  FadeIn,
  StaggerContainer,
  StaggerItem,
} from "@niva/ui";
import {
  ArrowRight,
  Bike,
  Clock,
  Flame,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { getCachedMe, loadSession, type Me } from "../lib/session";
import { UserMenu } from "../components/user-menu";

type ModuleDef = {
  title: string;
  description: string;
  href: string;
  icon: typeof UtensilsCrossed;
  badge: string;
  badgeVariant: "primary" | "purple" | "warning" | "info" | "success" | "glass" | "default";
  color: string;
  iconColor: string;
  actionLabel: string;
  requiredPermissions: string[];
};

const MODULES: ModuleDef[] = [
  {
    title: "POS & Billing Register",
    description: "Next-gen touch register with split billing, multi-tender checkout, and thermal tax invoices.",
    href: "/pos",
    icon: UtensilsCrossed,
    badge: "Fast Lane",
    badgeVariant: "primary",
    color: "from-orange-500/20 to-amber-500/10 border-orange-500/30",
    iconColor: "text-orange-400",
    actionLabel: "Launch POS",
    requiredPermissions: ["orders.create", "orders.view"],
  },
  {
    title: "Queue & Waitlist",
    description: "Smart token generation, party wait estimates, SMS seating alerts, and public TV kiosk screen.",
    href: "/queue",
    icon: Users,
    badge: "Smart Queue",
    badgeVariant: "purple",
    color: "from-purple-500/20 to-indigo-500/10 border-purple-500/30",
    iconColor: "text-purple-400",
    actionLabel: "Manage Queue",
    requiredPermissions: ["tables.view", "orders.view", "reservations.view"],
  },
  {
    title: "Kitchen Display (KDS)",
    description: "Expediter and station prep screens with real-time ticket bumping, cook timers, and auditory cues.",
    href: "/kds",
    icon: Flame,
    badge: "Live Orders",
    badgeVariant: "warning",
    color: "from-amber-500/20 to-red-500/10 border-amber-500/30",
    iconColor: "text-amber-400",
    actionLabel: "Open KDS",
    requiredPermissions: ["kitchen.view"],
  },
  {
    title: "Rider & Delivery Tower",
    description: "Dispatcher fleet control tower, live rider geolocation, delivery OTP verification, and COD audit.",
    href: "/driver",
    icon: Bike,
    badge: "Fleet Active",
    badgeVariant: "info",
    color: "from-blue-500/20 to-cyan-500/10 border-blue-500/30",
    iconColor: "text-blue-400",
    actionLabel: "Dispatch Tower",
    requiredPermissions: ["delivery.view", "delivery.manage", "delivery.self"],
  },
  {
    title: "Executive Dashboard",
    description: "Hourly sales velocity, category mix charts, top star menu items, and real-time revenue metrics.",
    href: "/dashboard",
    icon: LayoutDashboard,
    badge: "Analytics",
    badgeVariant: "success",
    color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30",
    iconColor: "text-emerald-400",
    actionLabel: "View Analytics",
    requiredPermissions: ["reports.view"],
  },
  {
    title: "Manager Live Ops",
    description: "Real-time kitchen bottlenecks, ticket throughput, urgent inventory thresholds, and active floor ops.",
    href: "/ops",
    icon: Zap,
    badge: "15s Heartbeat",
    badgeVariant: "glass",
    color: "from-slate-500/20 to-slate-700/10 border-slate-600/30",
    iconColor: "text-emerald-300",
    actionLabel: "Monitor Ops",
    requiredPermissions: ["orders.view", "restaurant.manage"],
  },
  {
    title: "System & Store Setup",
    description: "Multi-branch configuration, digital recipe catalog, table floor maps, staff RBAC, and tax classes.",
    href: "/setup/restaurant",
    icon: Settings,
    badge: "Admin",
    badgeVariant: "default",
    color: "from-zinc-500/20 to-zinc-700/10 border-zinc-600/30",
    iconColor: "text-zinc-300",
    actionLabel: "Configure ERP",
    requiredPermissions: ["restaurant.view", "restaurant.manage", "branch.view", "staff.view"],
  },
];

const STATS = [
  { label: "Active Orders", value: "24", change: "+18%", icon: Clock, positive: true },
  { label: "Daily Revenue", value: "₹48,250", change: "+14.6%", icon: TrendingUp, positive: true },
  { label: "Avg Turn Time", value: "32 mins", change: "-4 mins", icon: Zap, positive: true },
  { label: "Riders on Fleet", value: "8 Online", change: "100% active", icon: Bike, positive: true },
];

export default function HomePage() {
  const [me, setMe] = useState<Me | null>(getCachedMe);

  useEffect(() => {
    if (!me) {
      loadSession().then(setMe).catch(() => {});
    }
  }, [me]);

  const visibleModules = MODULES.filter((mod) => {
    if (!me) return true; // optimistic until loaded
    if (me.user.isPlatformAdmin) return true;
    return mod.requiredPermissions.some((perm) => me.permissions.includes(perm));
  });

  return (
    <div className="relative min-h-screen bg-canvas text-fg-primary overflow-x-hidden selection:bg-accent/30 selection:text-white">
      {/* Dynamic Ambient Background Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[650px] rounded-full bg-gradient-to-tr from-orange-600/20 via-amber-500/15 to-transparent blur-3xl opacity-70 animate-pulse-subtle" />
      <div className="pointer-events-none absolute top-[35%] -left-32 size-[450px] rounded-full bg-gradient-to-br from-emerald-600/15 to-transparent blur-3xl opacity-50 animate-float" />
      <div className="pointer-events-none absolute top-[60%] -right-32 size-[450px] rounded-full bg-gradient-to-bl from-blue-600/15 to-transparent blur-3xl opacity-50" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="MR.Genious Logo"
                className="h-10 w-auto max-w-[150px] object-contain drop-shadow-sm"
              />
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-bold tracking-tight">MR.Genious</span>
                  <Badge variant="primary" size="sm">ERP 2.0</Badge>
                </div>
                <p className="text-[11px] text-fg-muted font-mono">Restaurant Operating System</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="success" dot pulse size="md">
              Socket Realtime Active
            </Badge>
            {me?.user ? (
              <UserMenu />
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
            )}
            {(!me || me.user.isPlatformAdmin || me.permissions.includes("orders.create")) && (
              <Button asChild variant="gradient" size="sm" className="hidden sm:inline-flex">
                <Link href="/pos">Open POS Register</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <FadeIn className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3.5 py-1 text-xs font-medium text-fg-secondary shadow-sm backdrop-blur-md">
            <Sparkles className="size-3.5 text-accent animate-spin-slow" />
            <span>Modern Restaurant Intelligence & Point-of-Sale</span>
            <span className="text-accent font-semibold">• Fast & Resilient</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-fg-primary">
            Streamlined Dining, <br />
            <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">
              Frictionless Operations.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-fg-muted max-w-2xl mx-auto leading-relaxed">
            From lightning-fast billing and automated table queue tokens to live kitchen display and rider fleet dispatch — everything your restaurant needs in one cohesive cloud platform.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            {(!me || me.user.isPlatformAdmin || me.permissions.includes("orders.create")) && (
              <Button asChild variant="gradient" size="lg" className="shadow-lg shadow-orange-500/25">
                <Link href="/pos">
                  Launch Point of Sale
                  <ArrowRight className="size-4 ml-1" />
                </Link>
              </Button>
            )}
            {(!me || me.user.isPlatformAdmin || me.permissions.includes("reports.view")) && (
              <Button asChild variant="secondary" size="lg">
                <Link href="/dashboard">
                  <LayoutDashboard className="size-4" />
                  Owner Analytics
                </Link>
              </Button>
            )}
          </div>
        </FadeIn>

        {/* Live Operational Metrics Pulse */}
        <FadeIn delay={0.15} className="mt-12">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {STATS.map((stat) => (
              <Card
                key={stat.label}
                variant="glass"
                className="relative overflow-hidden p-4 sm:p-5 hover:border-accent/40 transition-all duration-300 group"
              >
                <div className="flex items-center justify-between text-xs text-fg-muted">
                  <span>{stat.label}</span>
                  <div className="flex size-7 items-center justify-center rounded-lg bg-surface/60 text-fg-secondary group-hover:text-accent transition-colors">
                    <stat.icon className="size-3.5" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-fg-primary">
                    {stat.value}
                  </span>
                  <span className="text-xs font-semibold text-emerald-400">
                    {stat.change}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </FadeIn>

        {/* Core Modules Grid */}
        <div className="mt-14">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-fg-primary tracking-tight">
                ERP Core Command Center
              </h2>
              <p className="text-sm text-fg-muted">
                Direct access to specialized workstations and management modules.
              </p>
            </div>
          </div>

          <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleModules.map((item) => {
              const Icon = item.icon;
              return (
                <StaggerItem key={item.title}>
                  <Link href={item.href} className="block h-full group">
                    <div
                      className={`relative flex h-full flex-col justify-between rounded-2xl border bg-gradient-to-b ${item.color} p-6 shadow-sm backdrop-blur-xl transition-all duration-300 hover:border-accent/50 hover:shadow-xl hover:shadow-orange-500/10 hover:-translate-y-1`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div
                            className={`flex size-12 items-center justify-center rounded-xl bg-surface/80 border border-border/80 shadow-inner ${item.iconColor}`}
                          >
                            <Icon className="size-6 transition-transform duration-300 group-hover:scale-110" />
                          </div>
                          <Badge variant={item.badgeVariant} size="sm">
                            {item.badge}
                          </Badge>
                        </div>

                        <h3 className="mt-4 text-lg font-bold text-fg-primary group-hover:text-accent transition-colors">
                          {item.title}
                        </h3>
                        <p className="mt-1.5 text-xs sm:text-sm text-fg-muted leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-accent group-hover:underline">
                        <span>{item.actionLabel}</span>
                        <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>

        {/* Feature Highlights Banner */}
        <FadeIn delay={0.3} className="mt-14">
          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-r from-surface via-elevated to-surface p-6 sm:p-8 backdrop-blur-xl">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center md:text-left">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
                  <ShieldCheck className="size-4" />
                  Enterprise Grade Reliability
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-fg-primary">
                  Offline-Ready POS, Multi-Tenancy & Live Sync
                </h3>
                <p className="text-xs sm:text-sm text-fg-muted max-w-xl">
                  Row-level security, immutable audit logs, sub-second socket broadcasts, and unified GST/VAT compliance built from day one.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {(!me || me.user.isPlatformAdmin || me.permissions.includes("restaurant.manage")) && (
                  <Link href="/setup/restaurant">
                    <Button variant="secondary" size="md">
                      Store Configuration
                    </Button>
                  </Link>
                )}
                {(!me || me.user.isPlatformAdmin || me.permissions.includes("orders.create")) && (
                  <Link href="/pos">
                    <Button variant="gradient" size="md">
                      Start Counter Shift
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </FadeIn>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-border/60 bg-surface/40 py-10 text-xs text-fg-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Link href="/" className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="MR.Genious" className="h-6 w-auto object-contain opacity-80" />
                <span className="font-display font-semibold text-fg-secondary">MR.Genious</span>
              </Link>
              <span className="hidden sm:inline text-fg-muted/60">•</span>
              <p>© {new Date().getFullYear()} MR.Genious Restaurant ERP System. All rights reserved.</p>
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-6 text-xs">
              <Link href="/terms" className="hover:text-accent transition-colors">
                Terms & Conditions
              </Link>
              <Link href="/privacy" className="hover:text-accent transition-colors">
                Privacy Policy
              </Link>
              <Link href="/refund-policy" className="hover:text-accent transition-colors">
                Return & Refund
              </Link>
              <Link href="/security" className="hover:text-accent transition-colors">
                Security & Compliance
              </Link>
              <Link href="/faqs" className="hover:text-accent transition-colors">
                FAQs
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
