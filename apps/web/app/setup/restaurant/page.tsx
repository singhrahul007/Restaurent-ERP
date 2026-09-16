"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type FormEvent } from "react";
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

export default function RestaurantSetupPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState("Could not load restaurant");
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

  async function onSubmit(values: FormValues) {
    const id = window.localStorage.getItem("niva_restaurant_id");
    if (!id) {
      return;
    }
    await api(`/restaurants/${id}`, {
      method: "PATCH",
      body: JSON.stringify(values),
    });
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
        title="No restaurant yet"
        description="Create a restaurant from the API, then refresh this page."
      />
    );
  }

  const taxInclusive = form.watch("taxInclusive");

  return (
    <>
      <PageHeader
        title="Restaurant profile"
        description="Name, address, and operating settings."
      />
      <Card>
        <form className="grid max-w-xl gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <TextFormField control={form.control} name="name" label="Name" />
          <TextFormField control={form.control} name="addressLine1" label="Address" />
          <TextFormField control={form.control} name="city" label="City" />
          <TextFormField control={form.control} name="region" label="State / region" />
          <TextFormField control={form.control} name="postalCode" label="Postal code" />
          <TextFormField control={form.control} name="timezone" label="Timezone" />
          <TextFormField control={form.control} name="currency" label="Currency" />
          <FormField id="inventoryPolicy" label="Inventory policy">
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
          <Button type="submit">Save</Button>
        </form>
      </Card>
    </>
  );
}
