"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AppShell,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
} from "@niva/ui";
import {
  ArrowLeft,
  CheckCircle2,
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { ApiError, api } from "../../lib/api";
import { SessionGate } from "../../lib/session-gate";

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
  return (
    <SessionGate>
      <PosContent />
    </SessionGate>
  );
}

function PosContent() {
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
      let organizationId = me.memberships[0]?.organizationId;
      if (!organizationId) {
        const org = await api<{ id: string }>("/organizations", {
          method: "POST",
          body: JSON.stringify({ name: "My organization" }),
        });
        organizationId = org.id;
      }
      if (organizationId) {
        window.localStorage.setItem("niva_organization_id", organizationId);
      }
      const restaurants = await api<{ restaurants: Array<{ id: string }> }>("/restaurants");
      let restaurantId = restaurants.restaurants[0]?.id;
      if (!restaurantId) {
        const rest = await api<{ id: string }>("/restaurants", {
          method: "POST",
          body: JSON.stringify({ name: "My Restaurant" }),
        });
        restaurantId = rest.id;
      }
      window.localStorage.setItem("niva_restaurant_id", restaurantId);
      const branches = await api<{ branches: Array<{ id: string }> }>(
        `/restaurants/${restaurantId}/branches`,
      );
      let branchId = branches.branches[0]?.id;
      if (!branchId) {
        const br = await api<{ id: string }>(`/restaurants/${restaurantId}/branches`, {
          method: "POST",
          body: JSON.stringify({ name: "Main" }),
        });
        branchId = br.id;
      }
      window.localStorage.setItem("niva_branch_id", branchId);
      const [cats, menuItems, tableList] = await Promise.all([
        api<{ categories: Category[] }>(`/restaurants/${restaurantId}/menu/categories`),
        api<{ items: MenuItem[] }>(`/restaurants/${restaurantId}/menu?branchId=${branchId}`),
        api<{ tables: Table[] }>(`/branches/${branchId}/tables`),
      ]);
      setCategories(cats.categories);
      setItems(menuItems.items);
      setTables(tableList.tables);
      setTableId(
        tableList.tables.find((row) => row.status === "VACANT" || row.status === "AVAILABLE")?.id ??
          tableList.tables[0]?.id ??
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

  function addItem(item: MenuItem) {
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

  function decrementItem(key: string) {
    setCart((current) => {
      const existing = current.find((line) => line.key === key);
      if (!existing) return current;
      if (existing.qty <= 1) {
        return current.filter((line) => line.key !== key);
      }
      return current.map((line) =>
        line.key === key ? { ...line, qty: line.qty - 1 } : line,
      );
    });
  }

  function removeItem(key: string) {
    setCart((current) => current.filter((line) => line.key !== key));
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
        <div className="flex h-screen items-center justify-center p-6">
          <Skeleton className="h-96 w-full max-w-4xl rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  if (status === "error" && items.length === 0) {
    return (
      <AppShell shell="pos">
        <div className="p-8">
          <ErrorState description={error} onRetry={() => void load()} />
        </div>
      </AppShell>
    );
  }

  if (receipt && order) {
    return (
      <AppShell shell="pos">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl print:border-none print:shadow-none print:max-w-none">
            <div className="text-center pb-4 border-b border-border/80">
              <div className="inline-flex items-center justify-center mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="MR.Genious"
                  className="h-12 w-auto max-w-[140px] object-contain"
                />
              </div>
              <h1 className="font-display text-xl font-bold tracking-tight text-fg-primary">MR.Genious DINING</h1>
              <p className="text-xs text-fg-muted font-mono mt-0.5">Official Tax Receipt</p>
              <div className="mt-2 inline-flex items-center gap-2 text-[11px] font-mono text-fg-muted">
                <span>Order #{order.id.slice(0, 8)}</span>
                <span>•</span>
                <span>{order.type}</span>
              </div>
            </div>

            <ul className="my-4 divide-y divide-border/60">
              {order.items.map((item) => (
                <li key={item.id} className="py-2 flex justify-between font-mono text-xs">
                  <span className="text-fg-primary">
                    <span className="font-bold text-accent mr-1.5">{item.qty}×</span>
                    {item.itemName}
                    {item.variantName ? ` (${item.variantName})` : ""}
                  </span>
                  <span className="font-medium text-fg-primary">{formatPaise(item.lineTotalMinor)}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-1.5 border-t border-border/80 pt-3 text-xs font-mono">
              <div className="flex justify-between text-fg-muted">
                <span>GST Tax (Included)</span>
                <span>{formatPaise(order.taxTotalMinor)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-fg-primary pt-1 border-t border-dashed border-border/60">
                <span>Total Amount</span>
                <span className="text-emerald-400 font-mono">{formatPaise(order.totalMinor)}</span>
              </div>
              {order.payments.map((payment) => (
                <div key={payment.id} className="flex justify-between text-xs text-emerald-500 pt-1">
                  <span>Paid ({payment.method})</span>
                  <span>{formatPaise(payment.amountMinor)}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-2.5 print:hidden">
              <Button variant="secondary" className="flex-1" onClick={() => window.print()}>
                <Printer className="size-4" />
                Print Bill
              </Button>
              <Button
                variant="gradient"
                className="flex-1"
                onClick={() => {
                  setReceipt(false);
                  setOrder(null);
                }}
              >
                New Order
              </Button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell shell="pos">
      {/* Top POS Command Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/80 bg-surface/90 backdrop-blur-xl px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-fg-secondary hover:text-fg-primary transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Hub
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-sm tracking-tight text-fg-primary">POS Terminal</span>
            <Badge variant="success" dot pulse size="sm">Online</Badge>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-rose-400 font-medium">{error}</span>}
          <div className="flex items-center rounded-lg border border-border bg-surface/80 p-0.5">
            <button
              type="button"
              onClick={() => setOrderType("DINE_IN")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                orderType === "DINE_IN" ? "bg-accent text-white" : "text-fg-muted hover:text-fg-primary"
              }`}
            >
              Dine-In
            </button>
            <button
              type="button"
              onClick={() => setOrderType("TAKEAWAY")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                orderType === "TAKEAWAY" ? "bg-accent text-white" : "text-fg-muted hover:text-fg-primary"
              }`}
            >
              Takeaway
            </button>
          </div>

          {orderType === "DINE_IN" && (
            <Select
              value={tableId}
              onChange={(event) => setTableId(event.target.value)}
              className="h-8 text-xs min-w-[130px]"
            >
              {tables.map((table) => (
                <option key={table.id} value={table.id}>
                  Table {table.code} ({table.status === "OCCUPIED" ? "Busy" : "Free"})
                </option>
              ))}
            </Select>
          )}
        </div>
      </header>

      {/* Main POS Ergonomic 3-Column Layout */}
      <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[14rem_1fr_24rem]">
        {/* Category Rail */}
        <aside className="border-r border-border/80 bg-surface/40 p-3 space-y-1">
          <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-fg-muted">
            Categories
          </p>
          <button
            type="button"
            className={`flex min-h-[38px] w-full items-center justify-between rounded-xl px-3 text-left text-xs font-semibold transition-all ${
              categoryId === "all"
                ? "bg-accent text-white shadow-md shadow-orange-500/20"
                : "text-fg-secondary hover:bg-elevated hover:text-fg-primary"
            }`}
            onClick={() => setCategoryId("all")}
          >
            <span>All Items</span>
            <span className="font-mono text-[10px] opacity-75">{items.length}</span>
          </button>
          {categories.map((category) => {
            const count = items.filter((item) => item.categoryId === category.id).length;
            const isSelected = categoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                className={`flex min-h-[38px] w-full items-center justify-between rounded-xl px-3 text-left text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-accent text-white shadow-md shadow-orange-500/20"
                    : "text-fg-secondary hover:bg-elevated hover:text-fg-primary"
                }`}
                onClick={() => setCategoryId(category.id)}
              >
                <span className="truncate">{category.name}</span>
                <span className="font-mono text-[10px] opacity-75">{count}</span>
              </button>
            );
          })}
        </aside>

        {/* Menu Items Grid */}
        <section className="bg-canvas p-4 overflow-y-auto">
          {/* Quick Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-fg-muted" />
            <Input
              id="pos-search"
              placeholder="Search dishes (Press '/' to focus)..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 pl-10 pr-4 text-sm rounded-xl bg-surface/90 border-border/80 backdrop-blur-md"
            />
          </div>

          {visibleItems.length === 0 ? (
            <EmptyState title="No menu items found" description="Adjust category filter or query." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visibleItems.map((item) => {
                const cartLine = cart.find((l) => l.menuItemId === item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addItem(item)}
                    className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-surface p-4 text-left shadow-sm transition-all duration-200 hover:border-accent/50 hover:shadow-lg hover:shadow-orange-500/5 hover:-translate-y-0.5 active:scale-[0.98]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-sm text-fg-primary group-hover:text-accent transition-colors line-clamp-2">
                          {item.name}
                        </span>
                        {cartLine && (
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-white text-xs font-bold shadow-sm">
                            {cartLine.qty}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between pt-2 border-t border-border/60">
                      <span className="font-mono font-bold text-sm text-emerald-400">
                        {formatPaise(item.basePriceMinor)}
                      </span>
                      <span className="rounded-lg bg-surface/80 px-2 py-1 text-[11px] font-semibold text-accent group-hover:bg-accent group-hover:text-white transition-all">
                        + Add
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Live Order & Smart Billing Sidebar */}
        <aside className="flex flex-col border-l border-border/80 bg-surface/95 backdrop-blur-xl p-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-border/80">
            <div className="flex items-center gap-2">
              <ShoppingBag className="size-4 text-accent" />
              <h2 className="text-base font-bold text-fg-primary">Active Bill</h2>
            </div>
            <Badge variant="glass" size="sm">
              {cart.reduce((sum, line) => sum + line.qty, 0)} items
            </Badge>
          </div>

          {/* Cart Item Lines */}
          <ul className="flex-1 space-y-2 overflow-y-auto py-3 pr-1">
            {cart.length === 0 && !order ? (
              <div className="py-16 text-center text-fg-muted">
                <UtensilsCrossed className="mx-auto size-8 opacity-40 mb-2" />
                <p className="text-xs">Cart is empty</p>
                <p className="text-[11px] text-fg-muted/70 mt-1">Tap any dish on the left to add.</p>
              </div>
            ) : null}

            {cart.map((line) => (
              <li
                key={line.key}
                className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-surface/60 p-2.5 backdrop-blur-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-fg-primary">{line.name}</p>
                  <p className="font-mono text-[11px] text-fg-muted">{formatPaise(line.unitPriceMinor)} each</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => decrementItem(line.key)}
                    className="flex size-7 items-center justify-center rounded-lg bg-surface border border-border text-fg-secondary hover:text-fg-primary hover:border-accent/50"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="w-6 text-center font-mono text-xs font-bold text-fg-primary">
                    {line.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => addItem({ id: line.menuItemId, name: line.name, categoryId: "", basePriceMinor: line.unitPriceMinor, effectiveAvailable: true })}
                    className="flex size-7 items-center justify-center rounded-lg bg-surface border border-border text-fg-secondary hover:text-fg-primary hover:border-accent/50"
                  >
                    <Plus className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(line.key)}
                    className="flex size-7 items-center justify-center rounded-lg text-fg-muted hover:text-rose-400 ml-1"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}

            {order && (
              <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs">
                <div className="flex justify-between font-semibold text-accent">
                  <span>Ticket Status</span>
                  <span>{order.status}</span>
                </div>
                <div className="flex justify-between text-fg-muted mt-1 font-mono">
                  <span>Balance Due</span>
                  <span className="text-white font-bold">{formatPaise(order.balanceMinor)}</span>
                </div>
              </div>
            )}
          </ul>

          {/* Billing & Settlement Total */}
          <div className="border-t border-border/80 pt-3 space-y-2">
            <div className="flex justify-between text-xs text-fg-muted">
              <span>Subtotal</span>
              <span className="font-mono">{formatPaise(cartTotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-fg-muted">
              <span>Estimated GST</span>
              <span className="font-mono">Included</span>
            </div>
            <div className="flex justify-between items-baseline pt-1 border-t border-dashed border-border/80">
              <span className="text-base font-bold text-fg-primary">Total</span>
              <span className="font-mono text-2xl font-extrabold text-emerald-400">
                {formatPaise(order ? order.totalMinor : cartTotal)}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="grid gap-2 pt-2">
              <Button
                variant="gradient"
                size="lg"
                disabled={busy || cart.length === 0}
                onClick={() => void placeOrder()}
                className="w-full shadow-lg shadow-orange-500/20"
              >
                <UtensilsCrossed className="size-4" />
                Place Kitchen Order
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="md"
                  variant="secondary"
                  disabled={busy || !order || order.balanceMinor <= 0}
                  onClick={() => void pay()}
                >
                  Pay Cash
                </Button>
                <Button
                  size="md"
                  variant="success"
                  disabled={busy || !order || order.balanceMinor > 0}
                  onClick={() => void closeCheck()}
                >
                  <CheckCircle2 className="size-4" />
                  Close Bill
                </Button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
