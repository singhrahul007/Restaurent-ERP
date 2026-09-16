"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, CardHeader, CardTitle, Input, Label } from "@niva/ui";
import { ApiError, api } from "../../lib/api";
import { clearCachedSession, loadSession } from "../../lib/session";

async function rememberTenant() {
  const me = await api<{
    memberships: Array<{ organizationId: string }>;
  }>("/auth/me");
  const organizationId = me.memberships[0]?.organizationId;
  if (organizationId) {
    window.localStorage.setItem("niva_organization_id", organizationId);
  }
  return organizationId ?? null;
}

async function bootstrapWorkspace() {
  let organizationId = await rememberTenant();
  if (!organizationId) {
    const organization = await api<{ id: string }>("/organizations", {
      method: "POST",
      body: JSON.stringify({ name: "My organization" }),
    });
    organizationId = organization.id;
    window.localStorage.setItem("niva_organization_id", organizationId);
  }

  const listed = await api<{ restaurants: Array<{ id: string }> }>("/restaurants");
  let restaurantId = listed.restaurants[0]?.id;
  if (!restaurantId) {
    const restaurant = await api<{ id: string }>("/restaurants", {
      method: "POST",
      body: JSON.stringify({ name: "My restaurant" }),
    });
    restaurantId = restaurant.id;
  }
  window.localStorage.setItem("niva_restaurant_id", restaurantId);

  const branches = await api<{ branches: Array<{ id: string }> }>(
    `/restaurants/${restaurantId}/branches`,
  );
  let branchId = branches.branches[0]?.id;
  if (!branchId) {
    const branch = await api<{ id: string }>(`/restaurants/${restaurantId}/branches`, {
      method: "POST",
      body: JSON.stringify({ name: "Main" }),
    });
    branchId = branch.id;
  }
  window.localStorage.setItem("niva_branch_id", branchId);
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (mode === "register") {
        await api("/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
      }
      clearCachedSession();
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await bootstrapWorkspace();
      await loadSession();
      router.push(mode === "register" ? "/dashboard" : "/setup/restaurant");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not sign in");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Card>
        <CardHeader>
          <CardTitle>{mode === "register" ? "Create account" : "Sign in"}</CardTitle>
        </CardHeader>
        <p className="mb-4 text-sm text-fg-muted">
          There is no default username. Create an account, then use that email and password.
          Password must be at least 8 characters.
        </p>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending
              ? mode === "register"
                ? "Creating account…"
                : "Signing in…"
              : mode === "register"
                ? "Create account"
                : "Sign in"}
          </Button>
          <button
            type="button"
            className="text-sm text-accent"
            onClick={() => {
              setError(null);
              setMode(mode === "register" ? "signin" : "register");
            }}
          >
            {mode === "register"
              ? "Already have an account? Sign in"
              : "New here? Create an account"}
          </button>
        </form>
      </Card>
    </main>
  );
}
