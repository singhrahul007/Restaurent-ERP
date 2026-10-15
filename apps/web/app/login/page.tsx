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
          Select a default demo account below or enter your credentials. All default accounts have full access.
        </p>

        {/* Default Demo Accounts Section */}
        <div className="mb-5 rounded-lg border border-border bg-subtle/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Default Credentials (Full Access)
            </span>
            <span className="text-[10px] text-accent font-medium">Click to fill</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                role: "Admin",
                email: "admin@restaurant.com",
                pass: "admin123",
                badge: "Platform Admin",
              },
              {
                role: "Owner",
                email: "owner@restaurant.com",
                pass: "owner123",
                badge: "Restaurant Owner",
              },
              {
                role: "Cook",
                email: "cook@restaurant.com",
                pass: "cook1234",
                badge: "Kitchen Lead",
              },
              {
                role: "Driver",
                email: "driver@restaurant.com",
                pass: "waiter1234",
                badge: "Delivery Fleet",
              },
              {
                role: "Waiter",
                email: "waiter@restaurant.com",
                pass: "waiter1234",
                badge: "Front-of-House",
              },
            ].map((account) => (
              <button
                key={account.role}
                type="button"
                onClick={() => {
                  setMode("signin");
                  setEmail(account.email);
                  setPassword(account.pass);
                  setError(null);
                }}
                className="group flex flex-col items-start rounded-md border border-border/80 bg-surface p-2 text-left transition hover:border-accent hover:bg-elevated focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-bold text-fg-primary group-hover:text-accent">
                    {account.role}
                  </span>
                  <span className="text-[9px] rounded bg-muted/60 px-1 py-0.5 text-fg-muted">
                    {account.badge}
                  </span>
                </div>
                <span className="mt-1 font-mono text-[11px] text-fg-secondary">
                  {account.email}
                </span>
                <span className="font-mono text-[10px] text-fg-muted">
                  pw: {account.pass}
                </span>
              </button>
            ))}
          </div>
        </div>

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
