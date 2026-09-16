"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AppShell,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
} from "@niva/ui";
import { ApiError, api } from "../../lib/api";

type Category = { id: string; name: string; parentId: string | null };
type MenuItem = {
  id: string;
  name: string;
  categoryId: string;
  basePriceMinor: number;
  effectiveAvailable: boolean;
};
type Table = { id: string; code: string; status: string };
type CartLine = {
  key: string;
  menuItemId: string;
  name: string;
  variantId: string | null;
  variantName: string | null;
  qty: number;
  unitPriceMinor: number;
};

type Order = {
  id: string;
  status: string;
  type: string;
  tableId: string | null;
  totalMinor: number;
  taxTotalMinor: number;
  discountTotalMinor: number;
  balanceMinor: number;
  items: Array<{
    id: string;
    itemName: string;
    variantName: string | null;
    qty: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
  }>;
  payments: Array<{ id: string; amountMinor: number; method: string }>;
};

function formatPaise(minor: number) {
  return `₹${(minor / 100).toFixed(2)}`;
}

export default function PosPage() {
  const router = useRouter();
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      const search = document.getElementById("pos-search");
      if (event.key === "/" && document.activeElement !== search) {
        event.preventDefault();
        search?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("Could not load POS");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [tableId, setTableId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [receipt, setReceipt] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const me = await api<{ memberships: Array<{ organizationId: string }> }>("/auth/me");
      const organizationId = me.memberships[0]?.organizationId;
      if (organizationId) {
        window.localStorage.setItem("niva_organization_id", organizationId);
      }
      const restaurants = await api<{ restaurants: Array<{ id: string }> }>("/restaurants");
      const restaurantId = restaurants.restaurants[0]?.id;
      if (!restaurantId) {
        throw new Error("No restaurant");
      }
      window.localStorage.setItem("niva_restaurant_id", restaurantId);
      const branches = await api<{ branches: Array<{ id: string }> }>(
        `/restaurants/${restaurantId}/branches`,
      );
      const branchId = branches.branches[0]?.id;
      if (!branchId) {
        throw new Error("No branch");
      }
      window.localStorage.setItem("niva_branch_id", branchId);
      const [menu, tableData] = await Promise.all([
        api<{ categories: Category[]; items: MenuItem[] }>(
          `/restaurants/${restaurantId}/menu?branchId=${branchId}`,
        ),
        api<{ tables: Table[] }>(`/branches/${branchId}/tables`),
      ]);
      setCategories(menu.categories);
      setItems(menu.items);
      setTables(tableData.tables);
      setTableId(
        tableData.tables.find((table) => table.status === "AVAILABLE")?.id ??
          tableData.tables[0]?.id ??
          "",
      );
      setError("");
      setStatus("ready");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }
      setError(caught instanceof ApiError ? caught.message : "Could not load POS");
      setStatus("error");
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (!item.effectiveAvailable) {
        return false;
      }
      if (categoryId !== "all" && item.categoryId !== categoryId) {
        return false;
      }
      if (query && !item.name.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [items, categoryId, query]);

  async function addItem(item: MenuItem) {
    const key = `${item.id}:`;
    setCart((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, qty: line.qty + 1 } : line,
        );
      }
      return [
        ...current,
        {
          key,
          menuItemId: item.id,
          name: item.name,
          variantId: null,
          variantName: null,
          qty: 1,
          unitPriceMinor: item.basePriceMinor,
        },
      ];
    });
  }

  const cartTotal = cart.reduce((sum, line) => sum + line.unitPriceMinor * line.qty, 0);

  async function placeOrder() {
    const branchId = window.localStorage.getItem("niva_branch_id");
    if (!branchId || cart.length === 0) {
      return;
    }
    if (orderType === "DINE_IN") {
      const table = tables.find((row) => row.id === tableId);
      if (table && table.status === "OCCUPIED") {
        setError("Table is occupied. Choose another table or takeaway.");
        return;
      }
    }
    setBusy(true);
    try {
      const created = await api<Order>(`/branches/${branchId}/orders`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          type: orderType,
          tableId: orderType === "DINE_IN" ? tableId : null,
          items: cart.map((line) => ({
            menuItemId: line.menuItemId,
            variantId: line.variantId,
            modifierIds: [],
            qty: line.qty,
          })),
        }),
      });
      setOrder(created);
      setCart([]);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not create order");
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!order || order.balanceMinor <= 0) {
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ order: Order }>(`/orders/${order.id}/payments`, {
        method: "POST",
        body: JSON.stringify({ amountMinor: order.balanceMinor, method: "CASH" }),
      });
      setOrder(result.order);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  async function closeCheck() {
    if (!order) {
      return;
    }
    setBusy(true);
    try {
      let current = order;
      if (current.status === "CREATED") {
        current = await api<Order>(`/orders/${current.id}/confirm`, { method: "POST" });
      }
      current = await api<Order>(`/orders/${current.id}/complete`, { method: "POST" });
      setOrder(current);
      setReceipt(true);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not complete order");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <AppShell shell="pos">
        <Skeleton className="h-screen" />
      </AppShell>
    );
  }
  if (status === "error" && items.length === 0) {
    return (
      <AppShell shell="pos">
        <ErrorState description={error} onRetry={() => void load()} />
      </AppShell>
    );
  }

  if (receipt && order) {
    return (
      <AppShell shell="pos">
        <div className="mx-auto max-w-md p-6 print:max-w-none">
          <h1 className="font-mono text-xl">Receipt</h1>
          <p className="text-sm text-fg-muted">{order.id}</p>
          <ul className="my-4 space-y-2">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between font-mono text-sm">
                <span>
                  {item.qty}× {item.itemName}
                  {item.variantName ? ` (${item.variantName})` : ""}
                </span>
                <span>{formatPaise(item.lineTotalMinor)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between font-mono">
            <span>Tax</span>
            <span>{formatPaise(order.taxTotalMinor)}</span>
          </p>
          <p className="flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>{formatPaise(order.totalMinor)}</span>
          </p>
          {order.payments.map((payment) => (
            <p key={payment.id} className="font-mono text-sm">
              {payment.method} {formatPaise(payment.amountMinor)}
            </p>
          ))}
          <div className="mt-6 flex gap-2 print:hidden">
            <Button onClick={() => window.print()}>Print</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setReceipt(false);
                setOrder(null);
              }}
            >
              New order
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell shell="pos">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[14rem_1fr_22rem]">
        <aside className="border-r border-border bg-pos p-3">
          <p className="mb-3 px-2 text-sm font-medium uppercase tracking-wide text-fg-muted">
            Categories
          </p>
          <button
            type="button"
            className={`mb-1 flex min-h-[var(--touch-min)] w-full items-center rounded-[var(--radius-md)] px-3 text-left text-[length:var(--text-md)] ${
              categoryId === "all" ? "bg-elevated" : ""
            }`}
            onClick={() => setCategoryId("all")}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`mb-1 flex min-h-[var(--touch-min)] w-full items-center rounded-[var(--radius-md)] px-3 text-left text-[length:var(--text-md)] ${
                categoryId === category.id ? "bg-elevated" : ""
              }`}
              onClick={() => setCategoryId(category.id)}
            >
              {category.name}
            </button>
          ))}
        </aside>
        <section className="bg-pos p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <Input
              id="pos-search"
              placeholder="Search items (/ )"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-[var(--touch-min)] max-w-sm"
            />
            <Select
              value={orderType}
              onChange={(event) =>
                setOrderType(event.target.value as "DINE_IN" | "TAKEAWAY")
              }
              className="min-h-[var(--touch-min)] w-40"
            >
              <option value="DINE_IN">Dine-in</option>
              <option value="TAKEAWAY">Takeaway</option>
            </Select>
            {orderType === "DINE_IN" ? (
              <Select
                value={tableId}
                onChange={(event) => setTableId(event.target.value)}
                className="min-h-[var(--touch-min)] w-48"
              >
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.code} ({table.status === "OCCUPIED" ? "occupied" : "free"})
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
          {visibleItems.length === 0 ? (
            <EmptyState title="No items" description="Add a menu or try another search." />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="min-h-24 rounded-[var(--radius-md)] border border-border bg-elevated p-4 text-left text-[length:var(--text-md)]"
                  onClick={() => addItem(item)}
                >
                  <span className="block font-medium">{item.name}</span>
                  <span className="font-mono text-sm text-fg-muted">
                    {formatPaise(item.basePriceMinor)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
        <aside className="flex flex-col border-l border-border bg-surface p-4">
          <h2 className="mb-3 text-lg font-semibold">Cart</h2>
          {error && items.length > 0 ? (
            <p className="mb-2 text-sm text-danger">{error}</p>
          ) : null}
          <ul className="flex-1 space-y-2 overflow-auto">
            {cart.map((line) => (
              <li key={line.key} className="flex justify-between gap-2 text-sm">
                <span>
                  {line.qty}× {line.name}
                </span>
                <span className="font-mono">{formatPaise(line.unitPriceMinor * line.qty)}</span>
              </li>
            ))}
            {order ? (
              <li className="text-sm text-fg-muted">
                Ticket {order.status} · due {formatPaise(order.balanceMinor)}
              </li>
            ) : null}
          </ul>
          <p className="my-3 flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span className="font-mono">
              {formatPaise(order ? order.totalMinor : cartTotal)}
            </span>
          </p>
          <div className="grid gap-2">
            <Button
              size="lg"
              disabled={busy || cart.length === 0}
              onClick={() => void placeOrder()}
            >
              Place order
            </Button>
            <Button
              size="lg"
              variant="secondary"
              disabled={busy || !order || order.balanceMinor <= 0}
              onClick={() => void pay()}
            >
              Pay cash
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={busy || !order || order.balanceMinor > 0}
              onClick={() => void closeCheck()}
            >
              Complete
            </Button>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
