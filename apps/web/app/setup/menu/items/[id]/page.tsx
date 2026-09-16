"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
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
} from "@niva/ui";
import { ApiError, api } from "../../../../../lib/api";

type Category = { id: string; name: string };
type TaxClass = { id: string; name: string };
type Branch = { id: string; name: string };
type Variant = { id: string; name: string; priceDeltaMinor: number; sku: string | null };
type Modifier = { id: string; name: string; priceDeltaMinor: number };
type ModifierGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  modifiers: Modifier[];
};
type Availability = { id: string; branchId: string | null; available: boolean };
type Item = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  taxClassId: string;
  basePriceMinor: number;
  available: boolean;
  variants: Variant[];
  modifierGroups: ModifierGroup[];
  availability: Availability[];
};

export default function MenuItemEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("Could not load item");
  const [item, setItem] = useState<Item | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [taxClasses, setTaxClasses] = useState<TaxClass[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allGroups, setAllGroups] = useState<ModifierGroup[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [taxClassId, setTaxClassId] = useState("");
  const [basePriceMinor, setBasePriceMinor] = useState(0);
  const [available, setAvailable] = useState(true);
  const [variantName, setVariantName] = useState("");
  const [variantDelta, setVariantDelta] = useState(0);
  const [groupName, setGroupName] = useState("");
  const [minSelect, setMinSelect] = useState(0);
  const [maxSelect, setMaxSelect] = useState(1);
  const [modifierName, setModifierName] = useState("");
  const [modifierDelta, setModifierDelta] = useState(0);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [branchId, setBranchId] = useState("");

  async function load() {
    setStatus("loading");
    const restaurantId = window.localStorage.getItem("niva_restaurant_id");
    try {
      const [loaded, catalog, branchData] = await Promise.all([
        api<Item>(`/menu/items/${params.id}`),
        restaurantId
          ? api<{
              categories: Category[];
              taxClasses: TaxClass[];
              modifierGroups: ModifierGroup[];
            }>(`/restaurants/${restaurantId}/menu`)
          : Promise.resolve({
              categories: [] as Category[],
              taxClasses: [] as TaxClass[],
              modifierGroups: [] as ModifierGroup[],
            }),
        restaurantId
          ? api<{ branches: Branch[] }>(`/restaurants/${restaurantId}/branches`)
          : Promise.resolve({ branches: [] as Branch[] }),
      ]);
      setItem(loaded);
      setName(loaded.name);
      setDescription(loaded.description ?? "");
      setCategoryId(loaded.categoryId);
      setTaxClassId(loaded.taxClassId);
      setBasePriceMinor(loaded.basePriceMinor);
      setAvailable(loaded.available);
      setCategories(catalog.categories);
      setTaxClasses(catalog.taxClasses);
      setAllGroups(catalog.modifierGroups);
      setBranches(branchData.branches);
      setBranchId(branchData.branches[0]?.id ?? "");
      setSelectedGroupId(catalog.modifierGroups[0]?.id ?? "");
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load item");
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    await api(`/menu/items/${params.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name,
        description: description || null,
        categoryId,
        taxClassId,
        basePriceMinor,
        available,
      }),
    });
    await load();
  }

  async function addVariant(event: FormEvent) {
    event.preventDefault();
    await api(`/menu/items/${params.id}/variants`, {
      method: "POST",
      body: JSON.stringify({ name: variantName, priceDeltaMinor: variantDelta }),
    });
    setVariantName("");
    setVariantDelta(0);
    await load();
  }

  async function addGroup(event: FormEvent) {
    event.preventDefault();
    const restaurantId = window.localStorage.getItem("niva_restaurant_id");
    if (!restaurantId) {
      return;
    }
    const group = await api<{ id: string }>(
      `/restaurants/${restaurantId}/menu/modifier-groups`,
      {
        method: "POST",
        body: JSON.stringify({ name: groupName, minSelect, maxSelect }),
      },
    );
    const attachedIds = [...(item?.modifierGroups.map((row) => row.id) ?? []), group.id];
    await api(`/menu/items/${params.id}/modifier-groups`, {
      method: "PUT",
      body: JSON.stringify({ modifierGroupIds: attachedIds }),
    });
    setGroupName("");
    await load();
  }

  async function attachExisting() {
    if (!selectedGroupId) {
      return;
    }
    const attachedIds = new Set(item?.modifierGroups.map((row) => row.id) ?? []);
    attachedIds.add(selectedGroupId);
    await api(`/menu/items/${params.id}/modifier-groups`, {
      method: "PUT",
      body: JSON.stringify({ modifierGroupIds: [...attachedIds] }),
    });
    await load();
  }

  async function addModifier(groupId: string, event: FormEvent) {
    event.preventDefault();
    await api(`/menu/modifier-groups/${groupId}/modifiers`, {
      method: "POST",
      body: JSON.stringify({ name: modifierName, priceDeltaMinor: modifierDelta }),
    });
    setModifierName("");
    setModifierDelta(0);
    await load();
  }

  async function eightySix(scopeBranchId: string | null, nextAvailable: boolean) {
    await api(`/menu/items/${params.id}/availability`, {
      method: "PUT",
      body: JSON.stringify({ available: nextAvailable, branchId: scopeBranchId }),
    });
    await load();
  }

  async function removeItem() {
    await api(`/menu/items/${params.id}`, { method: "DELETE" });
    router.push("/setup/menu");
  }

  if (status === "loading") {
    return <Skeleton className="h-64" />;
  }
  if (status === "error") {
    return <ErrorState description={error} onRetry={() => void load()} />;
  }
  if (!item) {
    return <EmptyState title="Item not found" />;
  }

  const restaurant86 = item.availability.find((row) => row.branchId === null);

  return (
    <>
      <PageHeader
        title={item.name}
        description="Variants, modifiers, and 86 overlays. Money stays in integer paise."
        actions={
          <Button variant="danger" type="button" onClick={() => void removeItem()}>
            Delete
          </Button>
        }
      />
      <div className="grid gap-6">
        <Card>
          <form className="grid max-w-xl gap-4" onSubmit={(event) => void saveItem(event)}>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="categoryId">Category</Label>
              <Select
                id="categoryId"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="taxClassId">Tax class</Label>
              <Select
                id="taxClassId"
                value={taxClassId}
                onChange={(event) => setTaxClassId(event.target.value)}
              >
                {taxClasses.map((taxClass) => (
                  <option key={taxClass.id} value={taxClass.id}>
                    {taxClass.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="basePriceMinor">Base price (paise)</Label>
              <Input
                id="basePriceMinor"
                type="number"
                step={1}
                value={basePriceMinor}
                onChange={(event) =>
                  setBasePriceMinor(Number.parseInt(event.target.value, 10) || 0)
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={available}
                onChange={(event) => setAvailable(event.target.checked)}
              />
              Available by default
            </label>
            <Button type="submit">Save item</Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-fg-secondary">86 / availability overlay</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void eightySix(null, false)}
            >
              86 restaurant-wide
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void eightySix(null, true)}
            >
              Restore restaurant-wide
            </Button>
            {restaurant86 ? (
              <p className="self-center text-sm text-fg-muted">
                Restaurant overlay: {restaurant86.available ? "available" : "86"}
              </p>
            ) : null}
          </div>
          {branches.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2">
              <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void eightySix(branchId, false)}
              >
                86 this branch
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void eightySix(branchId, true)}
              >
                Restore branch
              </Button>
            </div>
          ) : null}
          {item.availability
            .filter((row) => row.branchId)
            .map((row) => (
              <p key={row.id} className="mt-2 text-sm text-fg-muted">
                Branch {row.branchId}: {row.available ? "available" : "86"}
              </p>
            ))}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-fg-secondary">Variants</h2>
          <ul className="mb-4 space-y-1 text-sm">
            {item.variants.map((variant) => (
              <li key={variant.id} className="flex justify-between gap-4">
                <span>{variant.name}</span>
                <span className="font-mono">{variant.priceDeltaMinor} paise</span>
              </li>
            ))}
          </ul>
          <form className="grid max-w-md gap-2" onSubmit={(event) => void addVariant(event)}>
            <Label htmlFor="variantName">Name</Label>
            <Input
              id="variantName"
              value={variantName}
              onChange={(event) => setVariantName(event.target.value)}
              required
            />
            <Label htmlFor="variantDelta">Price delta (paise)</Label>
            <Input
              id="variantDelta"
              type="number"
              step={1}
              value={variantDelta}
              onChange={(event) =>
                setVariantDelta(Number.parseInt(event.target.value, 10) || 0)
              }
            />
            <Button type="submit" size="sm">
              Add variant
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-fg-secondary">Modifier groups</h2>
          {item.modifierGroups.map((group) => (
            <div key={group.id} className="mb-4 rounded-[var(--radius-md)] border border-border p-3">
              <p className="text-sm font-medium">
                {group.name} ({group.minSelect}–{group.maxSelect})
              </p>
              <ul className="my-2 text-sm">
                {group.modifiers.map((modifier) => (
                  <li key={modifier.id} className="flex justify-between">
                    <span>{modifier.name}</span>
                    <span className="font-mono">{modifier.priceDeltaMinor}</span>
                  </li>
                ))}
              </ul>
              <form
                className="grid max-w-md gap-2"
                onSubmit={(event) => void addModifier(group.id, event)}
              >
                <Input
                  placeholder="Modifier name"
                  value={modifierName}
                  onChange={(event) => setModifierName(event.target.value)}
                  required
                />
                <Input
                  type="number"
                  step={1}
                  value={modifierDelta}
                  onChange={(event) =>
                    setModifierDelta(Number.parseInt(event.target.value, 10) || 0)
                  }
                />
                <Button type="submit" size="sm">
                  Add modifier
                </Button>
              </form>
            </div>
          ))}
          <form className="mb-4 grid max-w-md gap-2" onSubmit={(event) => void addGroup(event)}>
            <Label htmlFor="groupName">New group</Label>
            <Input
              id="groupName"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                step={1}
                min={0}
                value={minSelect}
                onChange={(event) => setMinSelect(Number.parseInt(event.target.value, 10) || 0)}
              />
              <Input
                type="number"
                step={1}
                min={0}
                value={maxSelect}
                onChange={(event) => setMaxSelect(Number.parseInt(event.target.value, 10) || 0)}
              />
            </div>
            <Button type="submit" size="sm">
              Create and attach
            </Button>
          </form>
          {allGroups.length > 0 ? (
            <div className="flex max-w-md gap-2">
              <Select
                value={selectedGroupId}
                onChange={(event) => setSelectedGroupId(event.target.value)}
              >
                {allGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
              <Button type="button" variant="secondary" onClick={() => void attachExisting()}>
                Attach
              </Button>
            </div>
          ) : null}
        </Card>
        <Link href="/setup/menu" className="text-sm text-accent">
          Back to menu
        </Link>
      </div>
    </>
  );
}
