"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@niva/ui";
import { ApiError, api } from "../../lib/api";

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
  return `${sign}₹${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export default function OwnerDashboardPage() {
  const [status, setStatus] = useState<"loading" | "empty" | "ready" | "error">("loading");
  const [error, setError] = useState("Could not load dashboard");
  const [sales, setSales] = useState<Sales | null>(null);
  const [items, setItems] = useState<Items["items"]>([]);
  const [inventory, setInventory] = useState<InventoryReport | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  async function load() {
    setStatus("loading");
    const restaurantId = window.localStorage.getItem("niva_restaurant_id");
    const branchId = window.localStorage.getItem("niva_branch_id");
    if (!restaurantId) {
      setStatus("empty");
      return;
    }
    const qs = branchId ? `?branchId=${branchId}` : "";
    try {
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
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="p-6">
        <ErrorState title="Dashboard unavailable" description={error} onRetry={() => void load()} />
      </div>
    );
  }

  if (status === "empty" || !sales || !inventory) {
    return (
      <div className="p-6">
        <EmptyState
          title="No restaurant selected"
          description="Finish setup and choose a restaurant to see sales."
        />
      </div>
    );
  }

  const maxRevenue = Math.max(...sales.trend.map((row) => row.revenueMinor), 1);

  return (
    <div className="p-6">
      <PageHeader
        title="Owner dashboard"
        description="Add a restaurant, staff, and menu under Setup, then sales show up here."
        actions={
          <Link href="/setup/restaurant" className="text-sm text-accent">
            Open setup
          </Link>
        }
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Today</CardDescription>
            <CardTitle>{formatInr(sales.today.revenueMinor)}</CardTitle>
          </CardHeader>
          <p className="text-sm text-fg-muted">
            {sales.today.orderCount} orders · AOV {formatInr(sales.today.aovMinor)}
          </p>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>This week</CardDescription>
            <CardTitle>{formatInr(sales.week.revenueMinor)}</CardTitle>
          </CardHeader>
          <p className="text-sm text-fg-muted">{sales.week.orderCount} orders</p>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>This month</CardDescription>
            <CardTitle>{formatInr(sales.month.revenueMinor)}</CardTitle>
          </CardHeader>
          <p className="text-sm text-fg-muted">{sales.month.orderCount} orders</p>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Stock (last cost)</CardDescription>
            <CardTitle>{formatInr(inventory.stock.valuationMinor)}</CardTitle>
          </CardHeader>
          <p className="text-sm text-fg-muted">
            Expenses {formatInr(inventory.expenses.amountMinor)}
          </p>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Seven-day revenue</CardTitle>
          <CardDescription>Completed orders, UTC days</CardDescription>
        </CardHeader>
        {sales.trend.every((row) => row.revenueMinor === 0) ? (
          <EmptyState title="No completed sales yet" description="Complete an order to see the trend." />
        ) : (
          <div className="flex h-40 items-end gap-2">
            {sales.trend.map((row) => (
              <div key={row.date} className="flex h-full flex-1 flex-col justify-end gap-1">
                <div
                  className="w-full rounded-t bg-accent"
                  style={{ height: `${Math.max(4, (row.revenueMinor / maxRevenue) * 100)}%` }}
                />
                <span className="text-center text-xs text-fg-muted">{row.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top items</CardTitle>
          </CardHeader>
          {items.length === 0 ? (
            <EmptyState title="No item sales" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={`${item.itemName}-${item.categoryName}`}>
                    <TableCell>{item.itemName}</TableCell>
                    <TableCell>{item.categoryName}</TableCell>
                    <TableCell>{item.qty}</TableCell>
                    <TableCell>{formatInr(item.revenueMinor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Low stock</CardTitle>
          </CardHeader>
          {alerts.length === 0 ? (
            <EmptyState title="No low-stock alerts" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Threshold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.inventoryItemId}>
                    <TableCell>{alert.name}</TableCell>
                    <TableCell>{alert.quantity}</TableCell>
                    <TableCell>{alert.threshold}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
