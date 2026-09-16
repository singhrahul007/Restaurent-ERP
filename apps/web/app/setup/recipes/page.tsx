"use client";

import { type FormEvent, useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
} from "@niva/ui";
import { ApiError, api } from "../../../lib/api";

type MenuItem = { id: string; name: string };
type InventoryItem = { id: string; name: string; sku: string };
type RecipeLine = { inventoryItemId: string; qtyBase: number };
type Recipe = {
  id: string;
  menuItemId: string;
  variantId: string | null;
  lines: RecipeLine[];
};

export default function RecipesSetupPage() {
  const [status, setStatus] = useState<"loading" | "empty" | "ready" | "error">("loading");
  const [error, setError] = useState("Could not load recipes");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [stock, setStock] = useState<InventoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [menuItemId, setMenuItemId] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [qtyBase, setQtyBase] = useState("1");

  async function load() {
    setStatus("loading");
    const restaurantId = window.localStorage.getItem("niva_restaurant_id");
    if (!restaurantId) {
      setStatus("empty");
      return;
    }
    try {
      const [recipeData, menuData, invData] = await Promise.all([
        api<{ recipes: Recipe[] }>(`/restaurants/${restaurantId}/recipes`),
        api<{ items: MenuItem[] }>(`/restaurants/${restaurantId}/menu`),
        api<{ items: InventoryItem[] }>(`/restaurants/${restaurantId}/inventory/items`),
      ]);
      setRecipes(recipeData.recipes);
      setMenuItems(menuData.items);
      setStock(invData.items);
      setMenuItemId(menuData.items[0]?.id ?? "");
      setInventoryItemId(invData.items[0]?.id ?? "");
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load recipes");
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    const restaurantId = window.localStorage.getItem("niva_restaurant_id");
    if (!restaurantId) {
      return;
    }
    await api(`/restaurants/${restaurantId}/recipes`, {
      method: "POST",
      body: JSON.stringify({
        menuItemId,
        lines: [{ inventoryItemId, qtyBase: Number(qtyBase) }],
      }),
    });
    setOpen(false);
    await load();
  }

  if (status === "loading") {
    return <Skeleton className="h-48" />;
  }
  if (status === "empty") {
    return (
      <EmptyState
        title="Select a restaurant"
        description="Create a restaurant, menu item, and inventory item first."
      />
    );
  }
  if (status === "error") {
    return <ErrorState description={error} onRetry={() => void load()} />;
  }

  const menuName = (id: string) => menuItems.find((item) => item.id === id)?.name ?? id;
  const stockName = (id: string) => stock.find((item) => item.id === id)?.name ?? id;

  return (
    <>
      <PageHeader
        title="Recipes"
        description="Bill of materials in base units. Writes require inventory.manage. Stock deducts on order complete when inventory policy is ON_SALE."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Add recipe</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New recipe</DialogTitle>
                <DialogDescription>One recipe per menu item (or variant). Quantities are integers in the inventory item base unit.</DialogDescription>
              </DialogHeader>
              <form className="flex flex-col gap-3" onSubmit={create}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rec-menu">Menu item</Label>
                  <Select
                    id="rec-menu"
                    value={menuItemId}
                    onChange={(event) => setMenuItemId(event.target.value)}
                  >
                    {menuItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rec-stock">Inventory item</Label>
                  <Select
                    id="rec-stock"
                    value={inventoryItemId}
                    onChange={(event) => setInventoryItemId(event.target.value)}
                  >
                    {stock.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.sku} — {item.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rec-qty">Qty (base units)</Label>
                  <Input
                    id="rec-qty"
                    inputMode="numeric"
                    value={qtyBase}
                    onChange={(event) => setQtyBase(event.target.value)}
                    required
                  />
                </div>
                <Button type="submit">Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      {recipes.length === 0 ? (
        <EmptyState title="No recipes" description="Link a menu item to inventory ingredients." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Menu item</TableHead>
              <TableHead>Lines</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipes.map((recipe) => (
              <TableRow key={recipe.id}>
                <TableCell>{menuName(recipe.menuItemId)}</TableCell>
                <TableCell>
                  {recipe.lines
                    .map((line) => `${stockName(line.inventoryItemId)} × ${line.qtyBase}`)
                    .join(", ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
