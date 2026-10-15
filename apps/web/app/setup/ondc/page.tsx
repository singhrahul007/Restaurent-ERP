"use client";

import { useEffect, useState } from "react";
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
  Skeleton,
  toast,
} from "@niva/ui";
import { ApiError, api } from "../../../lib/api";

interface Branch {
  id: string;
  name: string;
}

interface OndcConfig {
  id?: string;
  subscriberId: string;
  subscriberUrl: string;
  uniqueKeyId: string;
  signingPublicKey: string;
  signingPrivateKey?: string;
  gatewayUrl?: string;
  enabled: boolean;
  autoAcceptOrders: boolean;
  defaultPrepTimeMinutes: number;
}

export default function OndcSetupPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState("Could not load ONDC settings");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [restaurantId, setRestaurantId] = useState<string>("");

  const [config, setConfig] = useState<OndcConfig>({
    subscriberId: "",
    subscriberUrl: "",
    uniqueKeyId: "key-1",
    signingPublicKey: "",
    signingPrivateKey: "",
    gatewayUrl: "https://staging.gateway.ondc.org",
    enabled: true,
    autoAcceptOrders: true,
    defaultPrepTimeMinutes: 30,
  });

  const [saving, setSaving] = useState(false);
  const [catalogPreview, setCatalogPreview] = useState<any>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        let activeRestId = window.localStorage.getItem("niva_restaurant_id");
        if (!activeRestId) {
          const res = await api<{ restaurants: Array<{ id: string }> }>("/restaurants");
          if (!res.restaurants || res.restaurants.length === 0) {
            setStatus("empty");
            return;
          }
          activeRestId = res.restaurants[0]!.id;
          setRestaurantId(activeRestId);
          window.localStorage.setItem("niva_restaurant_id", activeRestId);
        } else {
          setRestaurantId(activeRestId);
        }

        await loadBranches(activeRestId);
      } catch (err) {
        setStatus("error");
        setError(err instanceof ApiError ? err.message : "Failed to load ONDC configuration");
      }
    }

    void loadData();
  }, []);

  async function loadBranches(restId: string) {
    try {
      const res = await api<{ branches: Branch[] }>(`/restaurants/${restId}/branches`);
      const list = res.branches ?? [];
      setBranches(list);

      if (list.length > 0) {
        const storedBranchId = window.localStorage.getItem("niva_branch_id");
        const activeBranch = list.find((b) => b.id === storedBranchId)?.id ?? list[0]!.id;
        setSelectedBranchId(activeBranch);
        await loadBranchConfig(activeBranch);
      } else {
        setStatus("empty");
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Failed to load branches");
    }
  }

  async function loadBranchConfig(branchId: string) {
    setStatus("loading");
    try {
      const data = await api<OndcConfig>(`/branches/${branchId}/ondc/config`);
      setConfig({
        subscriberId: data.subscriberId ?? "",
        subscriberUrl: data.subscriberUrl ?? "",
        uniqueKeyId: data.uniqueKeyId ?? "key-1",
        signingPublicKey: data.signingPublicKey ?? "",
        signingPrivateKey: "", // private key stays securely masked
        gatewayUrl: data.gatewayUrl ?? "https://staging.gateway.ondc.org",
        enabled: data.enabled ?? true,
        autoAcceptOrders: data.autoAcceptOrders ?? true,
        defaultPrepTimeMinutes: data.defaultPrepTimeMinutes ?? 30,
      });
      setStatus("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Not configured yet
        setConfig({
          subscriberId: `seller.${window.location.hostname}`,
          subscriberUrl: `${window.location.origin}/api/v1/ondc`,
          uniqueKeyId: "key-1",
          signingPublicKey: "",
          signingPrivateKey: "",
          gatewayUrl: "https://staging.gateway.ondc.org",
          enabled: true,
          autoAcceptOrders: true,
          defaultPrepTimeMinutes: 30,
        });
        setStatus("ready");
      } else {
        setStatus("error");
        setError(err instanceof ApiError ? err.message : "Error loading ONDC config");
      }
    }
  }

  async function handleGenerateKeys() {
    try {
      const result = await api<{ publicKeyBase64: string; privateKeyBase64: string }>(
        "/ondc/keys/generate",
        { method: "POST" },
      );
      setConfig((prev) => ({
        ...prev,
        signingPublicKey: result.publicKeyBase64,
        signingPrivateKey: result.privateKeyBase64,
      }));
      toast.success("New cryptographic Ed25519 keypair generated!");
    } catch {
      toast.error("Failed to generate keys");
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBranchId || !restaurantId) return;

    if (!config.signingPublicKey || !config.signingPrivateKey) {
      toast.error("Please generate or provide both signing public and private keys");
      return;
    }

    setSaving(true);
    try {
      await api(`/restaurants/${restaurantId}/branches/${selectedBranchId}/ondc/config`, {
        method: "PUT",
        body: JSON.stringify({
          subscriberId: config.subscriberId,
          subscriberUrl: config.subscriberUrl,
          uniqueKeyId: config.uniqueKeyId,
          signingPublicKey: config.signingPublicKey,
          signingPrivateKey: config.signingPrivateKey,
          gatewayUrl: config.gatewayUrl,
          enabled: config.enabled,
          autoAcceptOrders: config.autoAcceptOrders,
          defaultPreparationTimeMinutes: Number(config.defaultPrepTimeMinutes),
        }),
      });
      toast.success("ONDC seller settings saved successfully!");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save ONDC configuration");
    } finally {
      setSaving(false);
    }
  }

  async function handlePreviewCatalog() {
    if (!selectedBranchId || !restaurantId) return;
    setLoadingCatalog(true);
    try {
      const data = await api<{ catalog: any }>(
        `/restaurants/${restaurantId}/branches/${selectedBranchId}/ondc/catalog`,
      );
      setCatalogPreview(data.catalog);
      toast.success("ONDC live catalog preview loaded");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load catalog preview");
    } finally {
      setLoadingCatalog(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className="p-6">
        <EmptyState
          title="No branches available"
          description="Create at least one restaurant branch before configuring ONDC integration."
        />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="p-6">
        <ErrorState
          title="Failed to load ONDC channel"
          description={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="ONDC Integration"
        description="Direct Open Network for Digital Commerce (Beckn Protocol) Seller Node Configuration"
      />

      {/* Branch selector */}
      {branches.length > 1 && (
        <div className="flex items-center gap-3">
          <Label>Select Branch:</Label>
          <select
            value={selectedBranchId}
            onChange={(e) => {
              const bId = e.target.value;
              setSelectedBranchId(bId);
              void loadBranchConfig(bId);
            }}
            className="rounded border border-border bg-bg-surface px-3 py-1.5 text-sm"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main configuration form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Seller Node (BPP) Credentials</CardTitle>
              <CardDescription>
                Configure the Beckn protocol credentials registered with the ONDC registry
              </CardDescription>
            </div>
            <Badge variant={config.enabled ? "success" : "neutral"}>
              {config.enabled ? "Active Seller Node" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>

        <form onSubmit={handleSaveConfig} className="space-y-4 p-6 pt-0">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Subscriber ID (BPP ID)">
              <Input
                value={config.subscriberId}
                onChange={(e) => setConfig({ ...config, subscriberId: e.target.value })}
                placeholder="e.g. seller.niva.app"
                required
              />
            </FormField>

            <FormField label="Subscriber URL (BPP URI)">
              <Input
                value={config.subscriberUrl}
                onChange={(e) => setConfig({ ...config, subscriberUrl: e.target.value })}
                placeholder="https://api.yourdomain.com/api/v1/ondc"
                required
              />
            </FormField>

            <FormField label="Unique Key ID">
              <Input
                value={config.uniqueKeyId}
                onChange={(e) => setConfig({ ...config, uniqueKeyId: e.target.value })}
                placeholder="key-1"
                required
              />
            </FormField>

            <FormField label="Gateway URL">
              <Input
                value={config.gatewayUrl}
                onChange={(e) => setConfig({ ...config, gatewayUrl: e.target.value })}
                placeholder="https://staging.gateway.ondc.org"
              />
            </FormField>
          </div>

          <div className="rounded-lg border border-border bg-bg-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold">Cryptographic Signing Keys (Ed25519)</h4>
                <p className="text-xs text-fg-muted">
                  Used to generate and verify BLAKE-512 cryptographic signatures on Beckn payloads.
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={handleGenerateKeys}>
                Generate New Keypair
              </Button>
            </div>

            <FormField label="Public Key (Base64)">
              <Input
                value={config.signingPublicKey}
                onChange={(e) => setConfig({ ...config, signingPublicKey: e.target.value })}
                placeholder="Ed25519 Public Key"
                required
              />
            </FormField>

            <FormField label="Private Key (Base64)">
              <Input
                type="password"
                value={config.signingPrivateKey}
                onChange={(e) => setConfig({ ...config, signingPrivateKey: e.target.value })}
                placeholder={config.signingPublicKey ? "••••••••••••••••••••••••••••••••" : "Paste or generate private key"}
                required={!config.id}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pt-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enabled"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="enabled" className="cursor-pointer">
                Enable ONDC Storefront
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoAccept"
                checked={config.autoAcceptOrders}
                onChange={(e) => setConfig({ ...config, autoAcceptOrders: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="autoAccept" className="cursor-pointer">
                Auto-accept confirmed orders directly into Kitchen Display (KDS)
              </Label>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save ONDC Settings"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handlePreviewCatalog}
              disabled={loadingCatalog}
            >
              {loadingCatalog ? "Generating..." : "Preview ONDC Catalog"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Catalog Preview Modal / Drawer */}
      {catalogPreview && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>ONDC RET11 Live Catalog Preview</CardTitle>
                <CardDescription>
                  This is the exact JSON payload published to Buyer Apps (Paytm, Magicpin, PhonePe)
                </CardDescription>
              </div>
              <Button variant="ghost" onClick={() => setCatalogPreview(null)}>
                Close Preview
              </Button>
            </div>
          </CardHeader>
          <div className="p-6 pt-0">
            <pre className="max-h-96 overflow-auto rounded bg-bg-muted p-4 text-xs font-mono text-fg">
              {JSON.stringify(catalogPreview, null, 2)}
            </pre>
          </div>
        </Card>
      )}
    </div>
  );
}

