"use client";

import { useCallback, useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import { AppShell, Button, ErrorState, Skeleton } from "@niva/ui";
import { ApiError, api } from "../../lib/api";

type Ticket = {
  id: string;
  orderId: string;
  status: "NEW" | "IN_PROGRESS" | "READY" | string;
  orderType: string;
  tableCode: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    name: string;
    variantName: string | null;
    qty: number;
    modifiers: string[];
    status: string;
  }>;
};

type Columns = { NEW: Ticket[]; IN_PROGRESS: Ticket[]; READY: Ticket[] };

const MUTE_KEY = "niva_kds_mute";

function elapsedLabel(createdAt: string, now: number) {
  const started = new Date(createdAt).getTime();
  const seconds = Math.max(0, Math.floor((now - started) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function playAlert() {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = 880;
  gain.gain.value = 0.08;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.18);
  window.setTimeout(() => void context.close(), 400);
}

export default function KdsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("Could not load kitchen");
  const [columns, setColumns] = useState<Columns>({ NEW: [], IN_PROGRESS: [], READY: [] });
  const [now, setNow] = useState(() => Date.now());
  const [muted, setMuted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const load = useCallback(async () => {
    try {
      const me = await api<{ memberships: Array<{ organizationId: string }> }>("/auth/me");
      const organizationId = me.memberships[0]?.organizationId;
      if (organizationId) {
        window.localStorage.setItem("niva_organization_id", organizationId);
      }
      const restaurants = await api<{
        restaurants: Array<{ id: string; kitchenSoundEnabled?: boolean }>;
      }>("/restaurants");
      const restaurant = restaurants.restaurants[0];
      if (!restaurant) {
        throw new Error("No restaurant");
      }
      window.localStorage.setItem("niva_restaurant_id", restaurant.id);
      setSoundEnabled(restaurant.kitchenSoundEnabled !== false);
      const branches = await api<{ branches: Array<{ id: string }> }>(
        `/restaurants/${restaurant.id}/branches`,
      );
      const branchId = branches.branches[0]?.id;
      if (!branchId) {
        throw new Error("No branch");
      }
      window.localStorage.setItem("niva_branch_id", branchId);
      const board = await api<{ columns: Columns }>(`/branches/${branchId}/kitchen/tickets`);
      setColumns(board.columns);
      setStatus("ready");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }
      setError(caught instanceof ApiError ? caught.message : "Could not load kitchen");
      setStatus("error");
    }
  }, [router]);

  useEffect(() => {
    setMuted(window.localStorage.getItem(MUTE_KEY) === "1");
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const branchId = window.localStorage.getItem("niva_branch_id");
    const organizationId = window.localStorage.getItem("niva_organization_id");
    if (!branchId || status !== "ready") {
      return;
    }
    const origin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const socket: Socket = io(origin, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      auth: { organizationId },
    });
    socket.on("connect", () => {
      socket.emit("join", `kitchen:${branchId}`, () => undefined);
    });
    socket.on("kitchen.ticket.created", (ticket: Ticket) => {
      setColumns((current) => {
        const without = {
          NEW: current.NEW.filter((row) => row.id !== ticket.id),
          IN_PROGRESS: current.IN_PROGRESS.filter((row) => row.id !== ticket.id),
          READY: current.READY.filter((row) => row.id !== ticket.id),
        };
        const column = ticket.status === "READY" ? "READY" : ticket.status === "IN_PROGRESS" ? "IN_PROGRESS" : "NEW";
        return { ...without, [column]: [ticket, ...without[column]] };
      });
      const mute = window.localStorage.getItem(MUTE_KEY) === "1";
      if (!mute && soundEnabled) {
        playAlert();
      }
    });
    socket.on("kitchen.ticket.updated", (ticket: Ticket) => {
      setColumns((current) => {
        const without = {
          NEW: current.NEW.filter((row) => row.id !== ticket.id),
          IN_PROGRESS: current.IN_PROGRESS.filter((row) => row.id !== ticket.id),
          READY: current.READY.filter((row) => row.id !== ticket.id),
        };
        const column = ticket.status === "READY" ? "READY" : ticket.status === "IN_PROGRESS" ? "IN_PROGRESS" : "NEW";
        return { ...without, [column]: [ticket, ...without[column]] };
      });
    });
    const poll = window.setInterval(() => void load(), 8000);
    return () => {
      socket.close();
      window.clearInterval(poll);
    };
  }, [load, soundEnabled, status]);

  async function bump(ticket: Ticket) {
    const updated = await api<Ticket>(`/kitchen/tickets/${ticket.id}/ready`, { method: "POST" });
    setColumns((current) => ({
      NEW: current.NEW.filter((row) => row.id !== ticket.id),
      IN_PROGRESS: current.IN_PROGRESS.filter((row) => row.id !== ticket.id),
      READY: [updated, ...current.READY.filter((row) => row.id !== ticket.id)],
    }));
  }

  async function cookItem(itemId: string) {
    await api(`/kitchen/ticket-items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    await load();
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  }

  if (status === "loading") {
    return (
      <AppShell shell="kds">
        <Skeleton className="h-screen" />
      </AppShell>
    );
  }
  if (status === "error") {
    return (
      <AppShell shell="kds">
        <ErrorState description={error} onRetry={() => void load()} />
      </AppShell>
    );
  }

  const boards: Array<{ key: keyof Columns; title: string }> = [
    { key: "NEW", title: "New" },
    { key: "IN_PROGRESS", title: "Cooking" },
    { key: "READY", title: "Ready" },
  ];

  return (
    <AppShell shell="kds" className="min-h-screen p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-[length:var(--text-xl)] font-semibold">Kitchen</h1>
        <Button
          type="button"
          variant="secondary"
          className="z-[var(--z-kds-alert)] min-h-[var(--touch-min)]"
          onClick={toggleMute}
        >
          {muted || !soundEnabled ? "Sound off" : "Sound on"}
        </Button>
      </header>
      <div className="grid min-h-[calc(100vh-6rem)] grid-cols-1 gap-4 lg:grid-cols-3">
        {boards.map((board) => (
          <section key={board.key} className="rounded-[var(--radius-md)] bg-elevated p-3">
            <h2 className="mb-3 text-[length:var(--text-xl)] font-semibold text-accent">
              {board.title}
            </h2>
            <ul className="space-y-3">
              {columns[board.key].map((ticket) => (
                <li
                  key={ticket.id}
                  className="rounded-[var(--radius-md)] border border-border-strong bg-surface p-4"
                >
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <p className="text-[length:var(--text-xl)] font-semibold">
                      {ticket.tableCode ?? ticket.orderType}
                    </p>
                    <p className="font-mono text-[length:var(--text-md)] tabular-nums text-warning">
                      {elapsedLabel(ticket.createdAt, now)}
                    </p>
                  </div>
                  <ul className="space-y-1">
                    {ticket.items.map((item) => (
                      <li key={item.id} className="text-[length:var(--text-md)]">
                        <button
                          type="button"
                          className="min-h-[var(--touch-min)] w-full text-left"
                          onClick={() => void cookItem(item.id)}
                        >
                          {item.qty}× {item.name}
                          {item.variantName ? ` (${item.variantName})` : ""}
                          {item.modifiers.length > 0 ? ` · ${item.modifiers.join(", ")}` : ""}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {ticket.status !== "READY" ? (
                    <Button className="mt-3 w-full" size="lg" onClick={() => void bump(ticket)}>
                      Ready
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
