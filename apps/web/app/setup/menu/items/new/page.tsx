"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function NewMenuItemPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState("Could not load menu catalogs");
  const [categories, setCategories] = useState<Category[]>([]);
  const [taxClasses, setTaxClasses] = useState<TaxClass[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [taxClassId, setTaxClassId] = useState("");
  const [basePriceMinor, setBasePriceMinor] = useState(0);
  const [available, setAvailable] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function load() {
    setStatus("loading");
    const restaurantId = window.localStorage.getItem("niva_restaurant_id");
    if (!restaurantId) {
      setStatus("empty");
      return;
    }
    try {
      const data = await api<{
        categories: Category[];
        taxClasses: TaxClass[];
      }>(`/restaurants/${restaurantId}/menu`);
      setCategories(data.categories);
      setTaxClasses(data.taxClasses);
      setCategoryId(data.categories[0]?.id ?? "");
      setTaxClassId(data.taxClasses[0]?.id ?? "");
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load menu catalogs");
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const restaurantId = window.localStorage.getItem("niva_restaurant_id");
    if (!restaurantId) {
      return;
    }
    setSubmitError(null);
    try {
      const item = await api<{ id: string }>(`/restaurants/${restaurantId}/menu/items`, {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || null,
          categoryId,
          taxClassId,
          basePriceMinor,
          available,
        }),
      });
      router.push(`/setup/menu/items/${item.id}`);
    } catch (caught) {
      setSubmitError(caught instanceof ApiError ? caught.message : "Could not create item");
    }
  }

  if (status === "loading") {
    return <Skeleton className="h-64" />;
  }
  if (status === "error") {
    return <ErrorState description={error} onRetry={() => void load()} />;
  }
  if (status === "empty") {
    return (
      <EmptyState
        title="No restaurant selected"
        description="Finish restaurant setup first."
      />
    );
  }
  if (categories.length === 0 || taxClasses.length === 0) {
    return (
      <EmptyState
        title="Add a category and tax class first"
        description="Items need both a category and a tax class."
        action={
          <Link href="/setup/menu" className="text-accent">
            Back to menu
          </Link>
        }
      />
    );
  }

  return (
    <>
      <PageHeader title="New item" description="Base price is integer paise only." />
      <Card>
        <form className="grid max-w-xl gap-4" onSubmit={(event) => void onSubmit(event)}>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
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
              min={0}
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
            Available
          </label>
          {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
          <div className="flex gap-2">
            <Button type="submit">Create</Button>
            <Button type="button" variant="secondary" asChild>
              <Link href="/setup/menu">Cancel</Link>
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
