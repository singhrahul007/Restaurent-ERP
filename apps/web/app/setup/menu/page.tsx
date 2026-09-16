"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Label,
  PageHeader,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@niva/ui";
import { ApiError, api } from "../../../lib/api";

type Category = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

type MenuItem = {
  id: string;
  name: string;
  categoryId: string;
  basePriceMinor: number;
  available: boolean;
  effectiveAvailable: boolean;
};

type TaxClass = {
  id: string;
  name: string;
  inclusive: boolean;
  currentRate: { rateBps: number; cgstBps: number; sgstBps: number; igstBps: number } | null;
};

type MenuPayload = {
  categories: Category[];
  items: MenuItem[];
  taxClasses: TaxClass[];
};

function formatPaise(minor: number) {
  return `₹${(minor / 100).toFixed(2)}`;
}

export default function MenuSetupPage() {
  const [status, setStatus] = useState<"loading" | "empty" | "ready" | "error">("loading");
  const [error, setError] = useState("Could not load menu");
  const [data, setData] = useState<MenuPayload | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">("all");
  const [categoryName, setCategoryName] = useState("");
  const [parentId, setParentId] = useState("");
  const [taxName, setTaxName] = useState("GST 18%");
  const [rateBps, setRateBps] = useState(1800);
  const [cgstBps, setCgstBps] = useState(900);
  const [sgstBps, setSgstBps] = useState(900);
  const [igstBps, setIgstBps] = useState(0);
  const [inclusive, setInclusive] = useState(false);

  async function load() {
    setStatus("loading");
    const restaurantId = window.localStorage.getItem("niva_restaurant_id");
    if (!restaurantId) {
      setStatus("empty");
      return;
    }
    try {
      const payload = await api<MenuPayload>(`/restaurants/${restaurantId}/menu`);
      setData(payload);
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load menu");
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const items = useMemo(() => {
    if (!data) {
      return [];
    }
    if (selectedCategoryId === "all") {
      return data.items;
    }
    return data.items.filter((item) => item.categoryId === selectedCategoryId);
  }, [data, selectedCategoryId]);

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    const restaurantId = window.localStorage.getItem("niva_restaurant_id");
    if (!restaurantId) {
      return;
    }
    await api(`/restaurants/${restaurantId}/menu/categories`, {
      method: "POST",
      body: JSON.stringify({
        name: categoryName,
        parentId: parentId || undefined,
      }),
    });
    setCategoryName("");
    await load();
  }

  async function addTaxClass(event: FormEvent) {
    event.preventDefault();
    const restaurantId = window.localStorage.getItem("niva_restaurant_id");
    if (!restaurantId) {
      return;
    }
    await api(`/restaurants/${restaurantId}/tax-classes`, {
      method: "POST",
      body: JSON.stringify({
        name: taxName,
        inclusive,
        rateBps,
        cgstBps,
        sgstBps,
        igstBps,
      }),
    });
    await load();
  }

  if (status === "loading") {
    return <Skeleton className="h-64" />;
  }
  if (status === "error") {
    return <ErrorState description={error} onRetry={() => void load()} />;
  }
  if (status === "empty" || !data) {
    return (
      <EmptyState
        title="No restaurant selected"
        description="Create a restaurant first, then return to build the menu."
        action={
          <Link href="/setup/restaurant" className="text-accent">
            Restaurant setup
          </Link>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Menu"
        description="Categories, tax classes, and items. Prices are integer paise."
        actions={
          <Button asChild>
            <Link href="/setup/menu/items/new">Add item</Link>
          </Button>
        }
      />
      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="tax">Tax classes</TabsTrigger>
        </TabsList>
        <TabsContent value="items">
          <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
            <Card>
              <h2 className="mb-3 text-sm font-medium text-fg-secondary">Categories</h2>
              <button
                type="button"
                className={`mb-2 block w-full rounded-[var(--radius-sm)] px-2 py-1 text-left text-sm ${
                  selectedCategoryId === "all" ? "bg-elevated" : ""
                }`}
                onClick={() => setSelectedCategoryId("all")}
              >
                All items
              </button>
              <ul className="mb-4 space-y-1">
                {data.categories.map((category) => (
                  <li key={category.id} style={{ paddingLeft: category.parentId ? 16 : 0 }}>
                    <button
                      type="button"
                      className={`block w-full rounded-[var(--radius-sm)] px-2 py-1 text-left text-sm ${
                        selectedCategoryId === category.id ? "bg-elevated" : ""
                      }`}
                      onClick={() => setSelectedCategoryId(category.id)}
                    >
                      {category.name}
                    </button>
                  </li>
                ))}
              </ul>
              {data.categories.length === 0 ? (
                <p className="mb-3 text-sm text-fg-muted">No categories yet.</p>
              ) : null}
              <form className="grid gap-2" onSubmit={(event) => void addCategory(event)}>
                <Label htmlFor="categoryName">New category</Label>
                <Input
                  id="categoryName"
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  required
                />
                <Select value={parentId} onChange={(event) => setParentId(event.target.value)}>
                  <option value="">Top level</option>
                  {data.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
                <Button type="submit" size="sm">
                  Add category
                </Button>
              </form>
            </Card>
            {items.length === 0 ? (
              <EmptyState
                title="No items in this category"
                description="Add a menu item with an integer price in paise."
                action={
                  <Button asChild>
                    <Link href="/setup/menu/items/new">Add item</Link>
                  </Button>
                }
              />
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Available</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Link href={`/setup/menu/items/${item.id}`} className="text-accent">
                            {item.name}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono">{formatPaise(item.basePriceMinor)}</TableCell>
                        <TableCell>
                          {item.effectiveAvailable ? "Yes" : "86"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        </TabsContent>
        <TabsContent value="tax">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-sm font-medium text-fg-secondary">Rates in basis points</h2>
              <form className="grid gap-3" onSubmit={(event) => void addTaxClass(event)}>
                <div>
                  <Label htmlFor="taxName">Name</Label>
                  <Input
                    id="taxName"
                    value={taxName}
                    onChange={(event) => setTaxName(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="rateBps">Total rate (bps)</Label>
                  <Input
                    id="rateBps"
                    type="number"
                    step={1}
                    value={rateBps}
                    onChange={(event) => setRateBps(Number.parseInt(event.target.value, 10) || 0)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="cgstBps">CGST</Label>
                    <Input
                      id="cgstBps"
                      type="number"
                      step={1}
                      value={cgstBps}
                      onChange={(event) => setCgstBps(Number.parseInt(event.target.value, 10) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sgstBps">SGST</Label>
                    <Input
                      id="sgstBps"
                      type="number"
                      step={1}
                      value={sgstBps}
                      onChange={(event) => setSgstBps(Number.parseInt(event.target.value, 10) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="igstBps">IGST</Label>
                    <Input
                      id="igstBps"
                      type="number"
                      step={1}
                      value={igstBps}
                      onChange={(event) => setIgstBps(Number.parseInt(event.target.value, 10) || 0)}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={inclusive}
                    onChange={(event) => setInclusive(event.target.checked)}
                  />
                  Inclusive
                </label>
                <Button type="submit">Add tax class</Button>
              </form>
            </Card>
            {data.taxClasses.length === 0 ? (
              <EmptyState
                title="No tax classes"
                description="Create a GST class using integer basis points (1800 = 18%)."
              />
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead>Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.taxClasses.map((taxClass) => (
                      <TableRow key={taxClass.id}>
                        <TableCell>{taxClass.name}</TableCell>
                        <TableCell className="font-mono">
                          {taxClass.currentRate
                            ? `${taxClass.currentRate.rateBps} bps`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
