"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardTitle,
  EmptyState,
  ErrorState,
  FadeIn,
  Skeleton,
  StaggerContainer,
  StaggerItem,
} from "@niva/ui";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChefHat,
  Clock,
  Flame,
  RefreshCw,
} from "lucide-react";
import { ApiError, api } from "../../lib/api";

type Operations = {
  openOrders: number;
  kitchen: { NEW: number; IN_PROGRESS: number; READY: number };
};
type Alert = { inventoryItemId: string; name: string; sku: string; quantity: number; threshold: number };

export default function OpsDashboardPage() {
  const [status, setStatus] = useState<"loading" | "empty" | "ready" | "error">("loading");
  const [error, setError] = useState("Could not load operations");
  const [ops, setOps] = useState<Operations | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<string>("Just now");

  async function load() {
    try {
      let restaurantId = window.localStorage.getItem("niva_restaurant_id");
      let branchId = window.localStorage.getItem("niva_branch_id");

      if (!restaurantId) {
        const me = await api<{ memberships: Array<{ organizationId: string }> }>("/auth/me");
        const orgId = me.memberships[0]?.organizationId;
        if (orgId) {
          window.localStorage.setItem("niva_organization_id", orgId);
        }
        const listed = await api<{ restaurants: Array<{ id: string }> }>("/restaurants");
        restaurantId = listed.restaurants[0]?.id ?? null;
        if (restaurantId) {
          window.localStorage.setItem("niva_restaurant_id", restaurantId);
        }
      }

      if (restaurantId && !branchId) {
        const branches = await api<{ branches: Array<{ id: string }> }>(
          `/restaurants/${restaurantId}/branches`,
        );
        branchId = branches.branches[0]?.id ?? null;
        if (branchId) {
          window.localStorage.setItem("niva_branch_id", branchId);
        }
      }

      if (!restaurantId) {
        setStatus("empty");
        return;
      }

      const qs = branchId ? `?branchId=${branchId}` : "";
      const [opsData, alertData] = await Promise.all([
        api<Operations>(`/restaurants/${restaurantId}/reports/operations${qs}`),
        api<{ alerts: Alert[] }>(`/restaurants/${restaurantId}/inventory/alerts`),
      ]);
      setOps(opsData);
      setAlerts(alertData.alerts);
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load operations");
      setStatus((current) => (current === "ready" ? "ready" : "error"));
    }
  }

  useEffect(() => {
    setStatus("loading");
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  if (status === "loading" && !ops) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (status === "error" && !ops) {
    return (
      <div className="p-4">
        <ErrorState title="Ops board unavailable" description={error} onRetry={() => void load()} />
      </div>
    );
  }

  if (status === "empty" || !ops) {
    return (
      <div className="p-4">
        <EmptyState title="No restaurant selected" description="Pick a restaurant in setup first." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ops Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-fg-primary">
              Live Operations Control
            </h1>
            <Badge variant="success" dot pulse size="sm">
              Live 15s Heartbeat
            </Badge>
          </div>
          <p className="text-sm text-fg-muted mt-1">
            Realtime kitchen flow, ticket queue bottlenecks, and critical inventory alerts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-fg-muted font-mono">Synced: {lastRefreshed}</span>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Link href="/kds">
            <Button variant="gradient" size="sm">
              <ChefHat className="size-3.5" />
              Kitchen Screen
            </Button>
          </Link>
        </div>
      </div>

      {/* Operational Velocity Cards */}
      <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Open Orders */}
        <StaggerItem>
          <Card variant="glass" className="relative overflow-hidden group hover:border-orange-500/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Open Tickets</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400">
                <Clock className="size-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold tracking-tight text-fg-primary">{ops.openOrders}</span>
              <Badge variant="primary" size="sm">Active</Badge>
            </div>
            <p className="mt-2 text-xs text-fg-muted">Dine-In, Takeaway & Delivery</p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-orange-500 to-amber-500" />
          </Card>
        </StaggerItem>

        {/* Kitchen New */}
        <StaggerItem>
          <Card variant="glass" className="relative overflow-hidden group hover:border-amber-500/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Kitchen Queued</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                <Bell className="size-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold tracking-tight text-amber-300">{ops.kitchen.NEW}</span>
              <Badge variant="warning" size="sm">Pending Prep</Badge>
            </div>
            <p className="mt-2 text-xs text-fg-muted">Awaiting cook station bump</p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-amber-500" />
          </Card>
        </StaggerItem>

        {/* Kitchen In Progress */}
        <StaggerItem>
          <Card variant="glass" className="relative overflow-hidden group hover:border-blue-500/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">On The Line</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                <Flame className="size-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold tracking-tight text-blue-300">{ops.kitchen.IN_PROGRESS}</span>
              <Badge variant="info" size="sm">Cooking</Badge>
            </div>
            <p className="mt-2 text-xs text-fg-muted">Active firing at stations</p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500" />
          </Card>
        </StaggerItem>

        {/* Kitchen Ready */}
        <StaggerItem>
          <Card variant="glass" className="relative overflow-hidden group hover:border-emerald-500/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Ready For Pass</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="size-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold tracking-tight text-emerald-300">{ops.kitchen.READY}</span>
              <Badge variant="success" size="sm">Plated</Badge>
            </div>
            <p className="mt-2 text-xs text-fg-muted">Expediter pass & dispatch</p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-500" />
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Critical Stock Alerts section */}
      <FadeIn delay={0.15}>
        <Card variant="glass" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-rose-400" />
                Urgent Inventory Bottlenecks
              </CardTitle>
              <CardDescription>
                Ingredients and packaging materials requiring immediate purchase replenishment.
              </CardDescription>
            </div>
            <Badge variant={alerts.length > 0 ? "danger" : "success"} size="md">
              {alerts.length} Critical Items
            </Badge>
          </div>

          {alerts.length === 0 ? (
            <div className="rounded-xl border border-border/80 bg-surface/50 p-6 text-center text-fg-muted">
              <CheckCircle2 className="mx-auto size-8 text-emerald-400 mb-2" />
              <p className="text-sm font-semibold text-fg-primary">Zero Inventory Depletion Hazards</p>
              <p className="text-xs text-fg-muted mt-1">All stock levels exceed minimum emergency thresholds.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {alerts.map((alert) => (
                <div
                  key={alert.inventoryItemId}
                  className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 backdrop-blur-sm"
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate font-semibold text-sm text-fg-primary">{alert.name}</p>
                    <p className="font-mono text-xs text-fg-muted">SKU: {alert.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-sm font-bold text-rose-400">{alert.quantity}</span>
                    <span className="text-xs text-fg-muted"> / {alert.threshold}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </FadeIn>
    </div>
  );
}
