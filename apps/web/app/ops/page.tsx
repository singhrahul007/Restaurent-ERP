"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
} from "@niva/ui";
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

  async function load() {
    const restaurantId = window.localStorage.getItem("niva_restaurant_id");
    const branchId = window.localStorage.getItem("niva_branch_id");
    if (!restaurantId) {
      setStatus("empty");
      return;
    }
    const qs = branchId ? `?branchId=${branchId}` : "";
    try {
      const [opsData, alertData] = await Promise.all([
        api<Operations>(`/restaurants/${restaurantId}/reports/operations${qs}`),
        api<{ alerts: Alert[] }>(`/restaurants/${restaurantId}/inventory/alerts`),
      ]);
      setOps(opsData);
      setAlerts(alertData.alerts);
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
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (status === "error" && !ops) {
    return (
      <div className="p-6">
        <ErrorState title="Ops board unavailable" description={error} onRetry={() => void load()} />
      </div>
    );
  }

  if (status === "empty" || !ops) {
    return (
      <div className="p-6">
        <EmptyState title="No restaurant selected" description="Pick a restaurant in setup first." />
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Live operations"
        description="Open tickets and stock alerts — not a full P&L."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-accent p-4">
          <CardHeader className="mb-0">
            <CardDescription>Open tickets</CardDescription>
            <CardTitle className="text-3xl">{ops.openOrders}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="p-4">
          <CardHeader className="mb-0">
            <CardDescription>Kitchen new</CardDescription>
            <CardTitle className="text-3xl">{ops.kitchen.NEW}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="p-4">
          <CardHeader className="mb-0">
            <CardDescription>In progress</CardDescription>
            <CardTitle className="text-3xl">{ops.kitchen.IN_PROGRESS}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="p-4">
          <CardHeader className="mb-0">
            <CardDescription>Ready</CardDescription>
            <CardTitle className="text-3xl">{ops.kitchen.READY}</CardTitle>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Stock alerts</CardTitle>
          <CardDescription>{alerts.length} item(s) at or below threshold</CardDescription>
        </CardHeader>
        {alerts.length === 0 ? (
          <EmptyState title="All stock above threshold" />
        ) : (
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li
                key={alert.inventoryItemId}
                className="flex items-center justify-between rounded-[var(--radius-md)] border border-danger/30 bg-surface px-3 py-2"
              >
                <span>
                  {alert.name}{" "}
                  <span className="text-fg-muted">({alert.sku})</span>
                </span>
                <span className="text-sm text-danger">
                  {alert.quantity} / {alert.threshold}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
