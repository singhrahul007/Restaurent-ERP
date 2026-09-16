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

type Unit = { id: string; code: string; name: string };
type Item = {
  id: string;
  sku: string;
  name: string;
  baseUnitId: string;
  quantity: number | null;
  lowStockThreshold: number | null;
};
type Alert = {
  inventoryItemId: string;
  name: string;
  sku: string;
  quantity: number;
  threshold: number;
};

export default function InventorySetupPage() {
  const [status, setStatus] = useState<"loading" | "empty" | "ready" | "error">("loading");
  const [error, setError] = useState("Could not load inventory");
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [baseUnitId, setBaseUnitId] = useState("");
  const [threshold, setThreshold] = useState("0");
  const [createOpen, setCreateOpen] = useState(false);
  const [moveItem, setMoveItem] = useState<Item | null>(null);
  const [moveType, setMoveType] = useState<"ADJUSTMENT" | "WASTAGE">("ADJUSTMENT");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");

  async function load() {
    setStatus("loading");
    const restaurantId = window.localStorage.getItem("niva_restaurant_id");
    const branchId = window.localStorage.getItem("niva_branch_id");
    if (!restaurantId) {
      setStatus("empty");
      return;
    }
    try {
      const [unitData, itemData, alertData] = await Promise.all([
        api<{ units: Unit[] }>(`/restaurants/${restaurantId}/units`),
        api<{ items: Item[] }>(
          `/restaurants/${restaurantId}/inventory/items${branchId ? `?branchId=${branchId}` : ""}`,
        ),
        api<{ alerts: Alert[] }>(`/restaurants/${restaurantId}/inventory/alerts`),
      ]);
      setUnits(unitData.units);
      setItems(itemData.items);
      setAlerts(alertData.alerts);
      setBaseUnitId(unitData.units[0]?.id ?? "");
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load inventory");
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createItem(event: FormEvent) {
    event.preventDefault();
    const restaurantId = window.localStorage.getItem("niva_restaurant_id");
    if (!restaurantId) {
      return;
    }
    await api(`/restaurants/${restaurantId}/inventory/items`, {
      method: "POST",
      body: JSON.stringify({
        sku,
        name,
        baseUnitId,
        lowStockThreshold: threshold === "" ? null : Number(threshold),
      }),
    });
    setSku("");
    setName("");
    setCreateOpen(false);
    await load();
  }

  async function submitMove(event: FormEvent) {
    event.preventDefault();
    const branchId = window.localStorage.getItem("niva_branch_id");
    if (!branchId || !moveItem) {
      return;
    }
    await api(`/branches/${branchId}/inventory/transactions`, {
      method: "POST",
      body: JSON.stringify({
        type: moveType,
        inventoryItemId: moveItem.id,
        unitId: moveItem.baseUnitId,
        qtyInUnit: Number(qty),
        reason,
      }),
    });
    setMoveItem(null);
    setReason("");
    setQty("1");
    await load();
  }

  if (status === "loading") {
    return <Skeleton className="h-48" />;
  }
  if (status === "empty") {
    return (
      <EmptyState
        title="Select a restaurant"
        description="Create a restaurant first, then add inventory items."
      />
    );
  }
  if (status === "error") {
    return <ErrorState description={error} onRetry={() => void load()} />;
  }

  const unitCode = (id: string) => units.find((unit) => unit.id === id)?.code ?? "";

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Item master, branch balances, adjustments, and wastage."
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Add item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New inventory item</DialogTitle>
                <DialogDescription>SKU is unique per restaurant. Quantity is stored in the base unit.</DialogDescription>
              </DialogHeader>
              <form className="flex flex-col gap-3" onSubmit={createItem}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="inv-sku">SKU</Label>
                  <Input id="inv-sku" value={sku} onChange={(event) => setSku(event.target.value)} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="inv-name">Name</Label>
                  <Input id="inv-name" value={name} onChange={(event) => setName(event.target.value)} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="inv-unit">Base unit</Label>
                  <Select
                    id="inv-unit"
                    value={baseUnitId}
                    onChange={(event) => setBaseUnitId(event.target.value)}
                  >
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.code} — {unit.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="inv-threshold">Low stock threshold</Label>
                  <Input
                    id="inv-threshold"
                    inputMode="numeric"
                    value={threshold}
                    onChange={(event) => setThreshold(event.target.value)}
                  />
                </div>
                <Button type="submit">Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      {alerts.length > 0 ? (
        <p className="mb-4 text-sm text-danger">{alerts.length} low-stock alert(s)</p>
      ) : null}
      {items.length === 0 ? (
        <EmptyState title="No items" description="Add the first stock item." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>On hand</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.sku}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell>
                  {item.quantity == null ? "—" : `${item.quantity} ${unitCode(item.baseUnitId)}`}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setMoveItem(item);
                      setMoveType("ADJUSTMENT");
                      setReason("");
                    }}
                  >
                    Adjust
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Dialog open={Boolean(moveItem)} onOpenChange={(open) => !open && setMoveItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moveType === "WASTAGE" ? "Record wastage" : "Adjust stock"}</DialogTitle>
            <DialogDescription>
              {moveItem?.name}. Quantity is in the item base unit. Wastage decreases on-hand stock.
            </DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-3" onSubmit={submitMove}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-move-type">Type</Label>
              <Select
                id="inv-move-type"
                value={moveType}
                onChange={(event) => setMoveType(event.target.value as "ADJUSTMENT" | "WASTAGE")}
              >
                <option value="ADJUSTMENT">Adjustment</option>
                <option value="WASTAGE">Wastage</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-qty">Quantity</Label>
              <Input
                id="inv-qty"
                inputMode="numeric"
                value={qty}
                onChange={(event) => setQty(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-reason">Reason</Label>
              <Input
                id="inv-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
              />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
