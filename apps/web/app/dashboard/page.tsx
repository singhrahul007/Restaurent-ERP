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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@niva/ui";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Calendar,
  DollarSign,
  Flame,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import { ApiError, api } from "../../lib/api";
import { SessionGate } from "../../lib/session-gate";

type Sales = {
  today: { orderCount: number; revenueMinor: number; aovMinor: number };
  week: { orderCount: number; revenueMinor: number; aovMinor: number };
  month: { orderCount: number; revenueMinor: number; aovMinor: number };
  trend: Array<{ date: string; orderCount: number; revenueMinor: number }>;
};
type Items = {
  items: Array<{ itemName: string; categoryName: string; qty: number; revenueMinor: number }>;
};
type InventoryReport = {
  stock: { valuationMinor: number; method: string };
  expenses: { amountMinor: number; count: number };
};
type Alert = { inventoryItemId: string; name: string; sku: string; quantity: number; threshold: number };

function formatInr(minor: number) {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}₹${Math.trunc(abs / 100).toLocaleString("en-IN")}.${String(abs % 100).padStart(2, "0")}`;
}

export default function OwnerDashboardPage() {
  return (
    <SessionGate requiredPermission="reports.view">
      <OwnerDashboardContent />
    </SessionGate>
  );
}

function OwnerDashboardContent() {
  const [status, setStatus] = useState<"loading" | "empty" | "ready" | "error">("loading");
  const [error, setError] = useState("Could not load dashboard");
  const [sales, setSales] = useState<Sales | null>(null);
  const [items, setItems] = useState<Items["items"]>([]);
  const [inventory, setInventory] = useState<InventoryReport | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeChartMetric, setActiveChartMetric] = useState<"revenue" | "orders">("revenue");

  async function load() {
    setStatus("loading");
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
      const [salesData, itemData, inventoryData, alertData] = await Promise.all([
        api<Sales>(`/restaurants/${restaurantId}/reports/sales${qs}`),
        api<Items>(`/restaurants/${restaurantId}/reports/items${qs}`),
        api<InventoryReport>(`/restaurants/${restaurantId}/reports/inventory${qs}`),
        api<{ alerts: Alert[] }>(`/restaurants/${restaurantId}/inventory/alerts`),
      ]);
      setSales(salesData);
      setItems(itemData.items);
      setInventory(inventoryData);
      setAlerts(alertData.alerts);
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load dashboard");
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (status === "loading") {
    return (
      <div className="space-y-6 p-2 sm:p-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="p-4">
        <ErrorState title="Dashboard unavailable" description={error} onRetry={() => void load()} />
      </div>
    );
  }

  if (status === "empty" || !sales || !inventory) {
    return (
      <div className="p-4">
        <EmptyState
          title="No restaurant selected"
          description="Finish setup and choose a restaurant to see sales."
        />
      </div>
    );
  }

  const maxRevenue = Math.max(...sales.trend.map((row) => row.revenueMinor), 1);
  const maxOrders = Math.max(...sales.trend.map((row) => row.orderCount), 1);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-fg-primary">
              Executive Analytics
            </h1>
            <Badge variant="primary" size="sm">Realtime</Badge>
          </div>
          <p className="text-sm text-fg-muted mt-1">
            Realtime revenue velocity, ticket volume, category mix, and inventory valuation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/pos">
            <Button variant="gradient" size="sm" className="shadow-md shadow-orange-500/20">
              <UtensilsCrossed className="size-3.5" />
              Open POS
            </Button>
          </Link>
          <Link href="/setup/restaurant">
            <Button variant="secondary" size="sm">
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Today */}
        <StaggerItem>
          <Card variant="glass" className="relative overflow-hidden group hover:border-orange-500/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Today's Sales</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400 group-hover:scale-110 transition-transform">
                <DollarSign className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-fg-primary">
                {formatInr(sales.today.revenueMinor)}
              </h2>
              <div className="mt-2 flex items-center justify-between text-xs text-fg-muted">
                <span>{sales.today.orderCount} completed orders</span>
                <span className="font-medium text-emerald-400">AOV: {formatInr(sales.today.aovMinor)}</span>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-orange-500 to-amber-500" />
          </Card>
        </StaggerItem>

        {/* This Week */}
        <StaggerItem>
          <Card variant="glass" className="relative overflow-hidden group hover:border-emerald-500/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">This Week</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                <TrendingUp className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-fg-primary">
                {formatInr(sales.week.revenueMinor)}
              </h2>
              <div className="mt-2 flex items-center justify-between text-xs text-fg-muted">
                <span>{sales.week.orderCount} orders this week</span>
                <span className="inline-flex items-center text-emerald-400 font-semibold gap-0.5">
                  <ArrowUpRight className="size-3" /> +12.4%
                </span>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          </Card>
        </StaggerItem>

        {/* This Month */}
        <StaggerItem>
          <Card variant="glass" className="relative overflow-hidden group hover:border-blue-500/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">This Month</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
                <Calendar className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-fg-primary">
                {formatInr(sales.month.revenueMinor)}
              </h2>
              <div className="mt-2 flex items-center justify-between text-xs text-fg-muted">
                <span>{sales.month.orderCount} orders total</span>
                <span className="text-blue-400 font-semibold">Active Run</span>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
          </Card>
        </StaggerItem>

        {/* Stock & Expenses */}
        <StaggerItem>
          <Card variant="glass" className="relative overflow-hidden group hover:border-purple-500/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Inventory Value</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
                <Boxes className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-fg-primary">
                {formatInr(inventory.stock.valuationMinor)}
              </h2>
              <div className="mt-2 flex items-center justify-between text-xs text-fg-muted">
                <span>Expenses: {formatInr(inventory.expenses.amountMinor)}</span>
                <span className="text-purple-400 font-semibold">{inventory.expenses.count} bills</span>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* 7-Day Interactive Sales Chart */}
      <FadeIn delay={0.1}>
        <Card variant="glass" className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>7-Day Sales & Order Velocity</CardTitle>
                <Badge variant="glass" size="sm">Daily Breakdown</Badge>
              </div>
              <CardDescription>
                Visual trend of sales volume and ticket counts across the past 7 days.
              </CardDescription>
            </div>

            <div className="flex items-center rounded-xl border border-border bg-surface/80 p-1">
              <button
                type="button"
                onClick={() => setActiveChartMetric("revenue")}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                  activeChartMetric === "revenue"
                    ? "bg-accent text-white shadow-sm"
                    : "text-fg-muted hover:text-fg-primary"
                }`}
              >
                Revenue (₹)
              </button>
              <button
                type="button"
                onClick={() => setActiveChartMetric("orders")}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                  activeChartMetric === "orders"
                    ? "bg-accent text-white shadow-sm"
                    : "text-fg-muted hover:text-fg-primary"
                }`}
              >
                Order Volume
              </button>
            </div>
          </div>

          {sales.trend.every((row) => row.revenueMinor === 0 && row.orderCount === 0) ? (
            <EmptyState
              title="No sales recorded in the last 7 days"
              description="Complete orders in the POS to begin generating live trend charts."
            />
          ) : (
            <div className="mt-4 flex h-56 items-end gap-3 sm:gap-6 pt-6 px-2">
              {sales.trend.map((row) => {
                const heightPercent =
                  activeChartMetric === "revenue"
                    ? Math.max(8, (row.revenueMinor / maxRevenue) * 100)
                    : Math.max(8, (row.orderCount / maxOrders) * 100);

                const displayValue =
                  activeChartMetric === "revenue"
                    ? formatInr(row.revenueMinor)
                    : `${row.orderCount} orders`;

                return (
                  <div
                    key={row.date}
                    className="group relative flex h-full flex-1 flex-col justify-end items-center gap-2"
                  >
                    {/* Tooltip on hover */}
                    <div className="pointer-events-none absolute -top-12 z-20 hidden -translate-y-2 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-fg-primary shadow-xl group-hover:flex flex-col items-center whitespace-nowrap animate-fadeIn">
                      <span>{displayValue}</span>
                      <span className="text-[10px] text-fg-muted font-normal">{row.date}</span>
                    </div>

                    {/* Bar */}
                    <div
                      className="w-full rounded-t-xl bg-gradient-to-t from-orange-600 via-amber-500 to-orange-400 shadow-md group-hover:from-orange-500 group-hover:to-amber-300 transition-all duration-300 cursor-pointer"
                      style={{ height: `${heightPercent}%` }}
                    />

                    {/* Day label */}
                    <span className="text-center text-[11px] font-medium text-fg-muted group-hover:text-fg-primary transition-colors">
                      {row.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </FadeIn>

      {/* Dual Tables: Top Star Items & Low Stock Alerts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Selling Star Items */}
        <FadeIn delay={0.2}>
          <Card variant="glass">
            <div className="flex items-center justify-between mb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="size-4 text-orange-400" />
                  Top Menu Stars
                </CardTitle>
                <CardDescription>Most ordered items ranked by revenue</CardDescription>
              </div>
              <Badge variant="primary" size="sm">Best Sellers</Badge>
            </div>

            {items.length === 0 ? (
              <EmptyState title="No item sales logged yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dish / Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.slice(0, 7).map((item, index) => (
                    <TableRow key={`${item.itemName}-${item.categoryName}`}>
                      <TableCell className="font-semibold text-fg-primary flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-full bg-surface text-[10px] font-bold text-fg-muted border border-border">
                          {index + 1}
                        </span>
                        {item.itemName}
                      </TableCell>
                      <TableCell className="text-fg-muted text-xs">
                        <Badge variant="glass" size="sm">{item.categoryName}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">{item.qty}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-emerald-400">
                        {formatInr(item.revenueMinor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </FadeIn>

        {/* Low Stock Alerts */}
        <FadeIn delay={0.25}>
          <Card variant="glass">
            <div className="flex items-center justify-between mb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-400" />
                  Low Stock & Urgent Reorders
                </CardTitle>
                <CardDescription>Inventory items below par threshold</CardDescription>
              </div>
              <Badge variant={alerts.length > 0 ? "danger" : "success"} dot size="sm">
                {alerts.length > 0 ? `${alerts.length} Critical` : "Stock Healthy"}
              </Badge>
            </div>

            {alerts.length === 0 ? (
              <div className="py-8 text-center text-fg-muted">
                <Boxes className="mx-auto size-10 text-emerald-400/60 mb-2" />
                <p className="text-sm font-medium text-fg-primary">All Ingredients Well-Stocked</p>
                <p className="text-xs text-fg-muted mt-1">No items have fallen below safety inventory par levels.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient / Item</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="text-right">Par Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.inventoryItemId}>
                      <TableCell className="font-semibold text-rose-300">{alert.name}</TableCell>
                      <TableCell className="font-mono text-xs text-fg-muted">{alert.sku}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-rose-400">
                        {alert.quantity}
                      </TableCell>
                      <TableCell className="text-right font-mono text-fg-muted">
                        {alert.threshold}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
