"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Label,
  PageHeader,
  Select,
  Skeleton,
  TextFormField,
  toast,
} from "@niva/ui";
import { ApiError, api } from "../../../lib/api";

const schema = z.object({
  name: z.string().min(1).max(200),
  addressLine1: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  timezone: z.string().min(1).max(64),
  currency: z.string().length(3),
  taxInclusive: z.boolean(),
  inventoryPolicy: z.enum(["OFF", "ON_SALE", "MANUAL"]),
});

type FormValues = z.infer<typeof schema>;

type Restaurant = FormValues & { id: string };

function emptyToUndefined(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export default function RestaurantSetupPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState("Could not load restaurant");
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      timezone: "Asia/Kolkata",
      currency: "INR",
      taxInclusive: false,
      inventoryPolicy: "OFF",
    },
  });

  async function load() {
    setStatus("loading");
    try {
      const data = await api<{ restaurants: Restaurant[] }>("/restaurants");
      const restaurant = data.restaurants[0];
      if (!restaurant) {
        setStatus("empty");
        return;
      }
      window.localStorage.setItem("niva_restaurant_id", restaurant.id);
      form.reset({
        name: restaurant.name,
        addressLine1: restaurant.addressLine1 ?? "",
        city: restaurant.city ?? "",
        region: restaurant.region ?? "",
        postalCode: restaurant.postalCode ?? "",
        timezone: restaurant.timezone,
        currency: restaurant.currency,
        taxInclusive: Boolean(restaurant.taxInclusive),
        inventoryPolicy: restaurant.inventoryPolicy ?? "OFF",
      });
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load restaurant");
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function ensureOrganization(): Promise<string> {
    const existing = window.localStorage.getItem("niva_organization_id");
    if (existing) {
      return existing;
    }
    const listed = await api<{ organizations: Array<{ organizationId: string }> }>(
      "/organizations",
    );
    const organizationId = listed.organizations[0]?.organizationId;
    if (organizationId) {
      window.localStorage.setItem("niva_organization_id", organizationId);
      return organizationId;
    }
    const created = await api<{ id: string }>("/organizations", {
      method: "POST",
      body: JSON.stringify({ name: createName.trim() || "My organization" }),
    });
    window.localStorage.setItem("niva_organization_id", created.id);
    return created.id;
  }

  async function createRestaurant(event: FormEvent) {
    event.preventDefault();
    if (!createName.trim()) {
      return;
    }
    setCreating(true);
    setError("Could not create restaurant");
    try {
      await ensureOrganization();
      const restaurant = await api<{ id: string }>("/restaurants", {
        method: "POST",
        body: JSON.stringify({ name: createName.trim() }),
      });
      window.localStorage.setItem("niva_restaurant_id", restaurant.id);
      const branches = await api<{ branches: Array<{ id: string }> }>(
        `/restaurants/${restaurant.id}/branches`,
      );
      if (!branches.branches[0]) {
        const branch = await api<{ id: string }>(`/restaurants/${restaurant.id}/branches`, {
          method: "POST",
          body: JSON.stringify({ name: "Main" }),
        });
        window.localStorage.setItem("niva_branch_id", branch.id);
      } else {
        window.localStorage.setItem("niva_branch_id", branches.branches[0].id);
      }
      setCreateName("");
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not create restaurant");
      setStatus("error");
    } finally {
      setCreating(false);
    }
  }

  async function onSubmit(values: FormValues) {
    const id = window.localStorage.getItem("niva_restaurant_id");
    if (!id) {
      toast.error("Select a restaurant first.");
      return;
    }
    try {
      await api(`/restaurants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...values,
          addressLine1: emptyToUndefined(values.addressLine1),
          city: emptyToUndefined(values.city),
          region: emptyToUndefined(values.region),
          postalCode: emptyToUndefined(values.postalCode),
        }),
      });
      form.reset(values);
      toast.success("Restaurant saved");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not save restaurant");
    }
  }

  const taxInclusive = form.watch("taxInclusive");
  const { isSubmitting, errors } = form.formState;

  if (status === "loading") {
    return <Skeleton className="h-64" />;
  }
  if (status === "error") {
    return <ErrorState description={error} onRetry={() => void load()} />;
  }
  if (status === "empty") {
    return (
      <EmptyState
        title="No restaurant yet"
        description="Add a restaurant name to start setup. A Main branch is created automatically."
        action={
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={createRestaurant}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-restaurant">Restaurant name</Label>
              <Input
                id="new-restaurant"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={creating} className="self-end">
              {creating ? "Creating…" : "Create restaurant"}
            </Button>
          </form>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Restaurant profile"
        description="Create or edit the restaurant. Then add branches, staff, and menu items in the sidebar."
      />
      <Card>
        <form
          className="grid max-w-xl gap-4"
          onSubmit={form.handleSubmit(onSubmit, () => {
            toast.error("Check the highlighted fields.");
          })}
        >
          <TextFormField control={form.control} name="name" label="Name" />
          <TextFormField control={form.control} name="addressLine1" label="Address" />
          <TextFormField control={form.control} name="city" label="City" />
          <TextFormField control={form.control} name="region" label="State / region" />
          <TextFormField control={form.control} name="postalCode" label="Postal code" />
          <TextFormField control={form.control} name="timezone" label="Timezone" />
          <TextFormField control={form.control} name="currency" label="Currency" />
          <FormField
            id="inventoryPolicy"
            label="Inventory policy"
            error={errors.inventoryPolicy?.message}
          >
            <Select
              id="inventoryPolicy"
              {...form.register("inventoryPolicy")}
            >
              <option value="OFF">Off</option>
              <option value="ON_SALE">Deduct on sale</option>
              <option value="MANUAL">Manual</option>
            </Select>
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={taxInclusive}
              onChange={(event) => form.setValue("taxInclusive", event.target.checked)}
            />
            Prices include tax
          </label>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </form>
      </Card>
    </>
  );
}
