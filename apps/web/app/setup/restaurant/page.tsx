"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
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
  name: z.string().min(1, "Restaurant name is required").max(200),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(2, "Country code must be 2 letters (e.g. IN, US)").optional(),
  timezone: z.string().min(1, "Timezone is required").max(64),
  currency: z.string().length(3, "Currency must be 3 characters (e.g. INR)"),
  taxInclusive: z.boolean(),
  kitchenSoundEnabled: z.boolean().optional(),
  inventoryPolicy: z.enum(["OFF", "ON_SALE", "MANUAL"]),
});

type FormValues = z.infer<typeof schema>;

type Restaurant = FormValues & {
  id: string;
  addressLine2?: string | null;
  country?: string | null;
  kitchenSoundEnabled?: boolean | null;
};

function emptyToUndefined(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export default function RestaurantSetupPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState("Could not load restaurant");
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      region: "",
      postalCode: "",
      country: "",
      timezone: "Asia/Kolkata",
      currency: "INR",
      taxInclusive: false,
      kitchenSoundEnabled: true,
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
      setRestaurantId(restaurant.id);
      window.localStorage.setItem("niva_restaurant_id", restaurant.id);
      form.reset({
        name: restaurant.name,
        addressLine1: restaurant.addressLine1 ?? "",
        addressLine2: restaurant.addressLine2 ?? "",
        city: restaurant.city ?? "",
        region: restaurant.region ?? "",
        postalCode: restaurant.postalCode ?? "",
        country: restaurant.country ?? "",
        timezone: restaurant.timezone,
        currency: restaurant.currency,
        taxInclusive: Boolean(restaurant.taxInclusive),
        kitchenSoundEnabled: restaurant.kitchenSoundEnabled !== false,
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
    const id = restaurantId || window.localStorage.getItem("niva_restaurant_id");
    if (!id) {
      toast.error("Select a restaurant first.");
      return;
    }
    setSaveMessage(null);
    try {
      const countryVal = emptyToUndefined(values.country);
      await api(`/restaurants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...values,
          currency: values.currency.toUpperCase(),
          addressLine1: emptyToUndefined(values.addressLine1),
          addressLine2: emptyToUndefined(values.addressLine2),
          city: emptyToUndefined(values.city),
          region: emptyToUndefined(values.region),
          postalCode: emptyToUndefined(values.postalCode),
          country: countryVal ? countryVal.toUpperCase() : undefined,
        }),
      });
      form.reset(values);
      setSaveMessage("All changes saved successfully.");
      toast.success("Restaurant profile updated.");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not save restaurant");
    }
  }

  const taxInclusive = form.watch("taxInclusive");
  const kitchenSoundEnabled = form.watch("kitchenSoundEnabled");
  const { isSubmitting, errors, isDirty } = form.formState;

  if (status === "loading") {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
          <div className="space-y-6 lg:col-span-5">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
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
    <div className="space-y-6">
      <PageHeader
        title="Restaurant Profile"
        description="Manage your restaurant identity, location address, regional settings, and operational defaults."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => form.reset()}
              disabled={!isDirty || isSubmitting}
            >
              Discard
            </Button>
            <Button
              type="submit"
              size="sm"
              form="restaurant-profile-form"
              disabled={isSubmitting || !isDirty}
            >
              {isSubmitting ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        }
      />

      <form
        id="restaurant-profile-form"
        className="grid grid-cols-1 gap-6 lg:grid-cols-12"
        onSubmit={form.handleSubmit(onSubmit, () => {
          toast.error("Check the highlighted fields.");
        })}
      >
        {/* Left Column (7 cols): Identity & Physical Location */}
        <div className="space-y-6 lg:col-span-7">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>General Information</CardTitle>
                <Badge variant="primary">Active Establishment</Badge>
              </div>
              <CardDescription>
                Primary business identity shown across customer receipts, POS terminals, and online ordering.
              </CardDescription>
            </CardHeader>
            <div className="space-y-4">
              <TextFormField
                control={form.control}
                name="name"
                label="Restaurant Name"
                placeholder="e.g. Spice Symphony Bistro"
                description="The public brand name of your restaurant."
              />
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Location & Address</CardTitle>
              <CardDescription>
                Physical establishment address used for tax jurisdiction, customer receipts, and delivery calculations.
              </CardDescription>
            </CardHeader>
            <div className="space-y-4">
              <TextFormField
                control={form.control}
                name="addressLine1"
                label="Street Address"
                placeholder="e.g. 104 Park Avenue"
              />
              <TextFormField
                control={form.control}
                name="addressLine2"
                label="Suite / Unit / Floor (Optional)"
                placeholder="e.g. 2nd Floor, Suite 402"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextFormField
                  control={form.control}
                  name="city"
                  label="City"
                  placeholder="e.g. Mumbai"
                />
                <TextFormField
                  control={form.control}
                  name="region"
                  label="State / Province"
                  placeholder="e.g. Maharashtra"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextFormField
                  control={form.control}
                  name="postalCode"
                  label="Postal / ZIP Code"
                  placeholder="e.g. 400001"
                />
                <TextFormField
                  control={form.control}
                  name="country"
                  label="Country Code (2 letters)"
                  placeholder="e.g. IN, US, AE"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column (5 cols): Regional, Currency, Operations & Actions */}
        <div className="space-y-6 lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle>Regional & Localization</CardTitle>
              <CardDescription>
                Date, time zone, and monetary currency standards across all operations.
              </CardDescription>
            </CardHeader>
            <div className="space-y-4">
              <FormField
                id="currency"
                label="Currency Code"
                description="3-letter ISO code (e.g. INR, USD, EUR, AED)."
                error={errors.currency?.message}
              >
                <div className="flex gap-2">
                  <Input
                    id="currency"
                    {...form.register("currency")}
                    placeholder="INR"
                    maxLength={3}
                    className="font-mono uppercase"
                  />
                  <Select
                    aria-label="Preset Currency"
                    className="w-36 shrink-0"
                    value={form.watch("currency") || "INR"}
                    onChange={(e) =>
                      form.setValue("currency", e.target.value, { shouldDirty: true })
                    }
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="AED">AED (د.إ)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                    <option value="SGD">SGD ($)</option>
                  </Select>
                </div>
              </FormField>

              <FormField
                id="timezone"
                label="Timezone"
                description="Applied to reports, kitchen orders, and staff shifts."
                error={errors.timezone?.message}
              >
                <Select id="timezone" {...form.register("timezone")}>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+05:30)</option>
                  <option value="UTC">UTC (Universal Coordinated Time)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST - UTC+04:00)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT - UTC+08:00)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST - UTC+09:00)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                </Select>
              </FormField>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing & Operations</CardTitle>
              <CardDescription>
                Inventory deduction policy and tax calculation preferences.
              </CardDescription>
            </CardHeader>
            <div className="space-y-4">
              <FormField
                id="inventoryPolicy"
                label="Inventory Tracking"
                description="Select how inventory items and recipes are deducted."
                error={errors.inventoryPolicy?.message}
              >
                <Select id="inventoryPolicy" {...form.register("inventoryPolicy")}>
                  <option value="OFF">Disabled — Do not deplete stock automatically</option>
                  <option value="ON_SALE">Automatic — Deduct stock on completed sale</option>
                  <option value="MANUAL">Manual — Adjust stock via counts and audits</option>
                </Select>
              </FormField>

              <div className="space-y-3 rounded-lg border border-border/80 bg-surface/60 p-3.5">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 rounded border-border text-accent focus:ring-accent"
                    checked={taxInclusive}
                    onChange={(event) =>
                      form.setValue("taxInclusive", event.target.checked, { shouldDirty: true })
                    }
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-fg-primary">Prices include tax</span>
                    <span className="text-xs text-fg-muted">
                      When active, menu item prices include applicable sales tax/GST.
                    </span>
                  </div>
                </label>

                <div className="border-t border-border/60" />

                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 rounded border-border text-accent focus:ring-accent"
                    checked={Boolean(kitchenSoundEnabled)}
                    onChange={(event) =>
                      form.setValue("kitchenSoundEnabled", event.target.checked, {
                        shouldDirty: true,
                      })
                    }
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-fg-primary">Kitchen sound chime</span>
                    <span className="text-xs text-fg-muted">
                      Play audio alert sound on kitchen display screens (KDS) for incoming orders.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </Card>

          <Card className="border-border/70 bg-surface/50">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-fg-muted">
                <span>Restaurant Identifier</span>
                <span className="font-mono">{restaurantId ? `${restaurantId.slice(0, 13)}…` : "—"}</span>
              </div>
              {saveMessage ? (
                <p className="text-xs font-medium text-emerald-400" role="status">
                  ✓ {saveMessage}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={isSubmitting || !isDirty}
                className="w-full"
              >
                {isSubmitting ? "Saving Changes…" : "Save Changes"}
              </Button>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}
