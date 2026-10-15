"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { io, type Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import { AppShell, Badge, Button, ErrorState, Skeleton } from "@niva/ui";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChefHat,
  Clock,
  Flame,
  Volume2,
  VolumeX,
} from "lucide-react";
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

function elapsedSeconds(createdAt: string, now: number) {
  const started = new Date(createdAt).getTime();
  return Math.max(0, Math.floor((now - started) / 1000));
}

function elapsedLabel(createdAt: string, now: number) {
  const seconds = elapsedSeconds(createdAt, now);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function playAlert() {
  try {
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
  } catch {
    // Audio context may require prior user interaction
  }
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
      const res = await api<{ columns: Columns }>(
        `/branches/${branchId}/kitchen/tickets`,
      );
      setColumns(res.columns ?? { NEW: [], IN_PROGRESS: [], READY: [] });
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
    const raw = window.localStorage.getItem(MUTE_KEY);
    if (raw !== null) {
      setMuted(raw === "true");
    }
    void load();
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const branchId = window.localStorage.getItem("niva_branch_id");
    const organizationId = window.localStorage.getItem("niva_organization_id");
    if (!branchId || !organizationId) {
      return;
    }
    const origin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const socket: Socket = io(origin, {
      path: "/socket.io",
      transports: ["websocket"],
      withCredentials: true,
      auth: { organizationId },
    });
    socket.on("connect", () => {
      socket.emit("join", `kitchen:${branchId}`);
    });
    const handleTicketCreated = () => {
      if (!muted && soundEnabled) {
        playAlert();
      }
      void load();
    };
    const handleTicketUpdated = () => void load();

    socket.on("kitchen.ticket.created", handleTicketCreated);
    socket.on("kitchen:ticket_created", handleTicketCreated);
    socket.on("kitchen.ticket.updated", handleTicketUpdated);
    socket.on("kitchen:ticket_updated", handleTicketUpdated);

    return () => {
      socket.disconnect();
    };
  }, [load, muted, soundEnabled]);

  function toggleMute() {
    setMuted((current) => {
      const next = !current;
      window.localStorage.setItem(MUTE_KEY, String(next));
      return next;
    });
  }

  async function bump(ticket: Ticket) {
    try {
      await api(`/kitchen/tickets/${ticket.id}/ready`, {
        method: "POST",
      });
      await load();
    } catch {
      // ignore
    }
  }

  async function cookItem(itemId: string) {
    try {
      await api(`/kitchen/ticket-items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "READY" }),
      });
      await load();
    } catch {
      // ignore
    }
  }

  if (status === "loading") {
    return (
      <AppShell shell="kds">
        <div className="p-6">
          <Skeleton className="h-screen rounded-2xl" />
        </div>
      </AppShell>
    );
  }
  if (status === "error") {
    return (
      <AppShell shell="kds">
        <div className="p-8">
          <ErrorState description={error} onRetry={() => void load()} />
        </div>
      </AppShell>
    );
  }

  const boards: Array<{
    key: keyof Columns;
    title: string;
    icon: typeof Flame;
    color: string;
    badgeVariant: "warning" | "info" | "success";
  }> = [
    { key: "NEW", title: "New Queued", icon: Bell, color: "text-amber-400 border-amber-500/30", badgeVariant: "warning" },
    { key: "IN_PROGRESS", title: "On The Line", icon: Flame, color: "text-blue-400 border-blue-500/30", badgeVariant: "info" },
    { key: "READY", title: "Ready For Pass", icon: CheckCircle2, color: "text-emerald-400 border-emerald-500/30", badgeVariant: "success" },
  ];

  return (
    <AppShell shell="kds" className="min-h-screen p-4 bg-kds text-fg-primary">
      {/* Top KDS Header */}
      <header className="mb-4 flex items-center justify-between border-b border-border/80 bg-surface/60 backdrop-blur-md rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-fg-secondary hover:text-fg-primary"
          >
            <ArrowLeft className="size-3.5" />
            Hub
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <ChefHat className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Kitchen Display System (KDS)</h1>
              <p className="text-xs text-fg-muted font-mono">Live Line Station Expediter</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="success" dot pulse size="sm">
            Live Stream Synced
          </Badge>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={toggleMute}
            className="font-medium text-xs"
          >
            {muted || !soundEnabled ? (
              <>
                <VolumeX className="size-4 text-rose-400" />
                Muted
              </>
            ) : (
              <>
                <Volume2 className="size-4 text-emerald-400" />
                Sound On
              </>
            )}
          </Button>
        </div>
      </header>

      {/* 3 Columns Kanban Board */}
      <div className="grid min-h-[calc(100vh-8.5rem)] grid-cols-1 gap-4 lg:grid-cols-3">
        {boards.map((board) => {
          const Icon = board.icon;
          const ticketList = columns[board.key] ?? [];
          return (
            <section
              key={board.key}
              className="flex flex-col rounded-2xl border border-border/80 bg-surface/50 backdrop-blur-md p-4 shadow-lg"
            >
              <div className="mb-4 flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Icon className={`size-5 ${board.color.split(" ")[0]}`} />
                  <h2 className="text-base font-bold text-white tracking-tight">{board.title}</h2>
                </div>
                <Badge variant={board.badgeVariant} size="sm">
                  {ticketList.length} tickets
                </Badge>
              </div>

              <ul className="flex-1 space-y-3.5 overflow-y-auto pr-1">
                {ticketList.length === 0 ? (
                  <div className="py-20 text-center text-fg-muted">
                    <p className="text-xs">No tickets in this station</p>
                  </div>
                ) : null}

                {ticketList.map((ticket) => {
                  const secs = elapsedSeconds(ticket.createdAt, now);
                  const isLate = secs > 900; // > 15 mins
                  const isWarning = secs > 480; // > 8 mins

                  return (
                    <li
                      key={ticket.id}
                      className={`rounded-2xl border p-4 shadow-md transition-all duration-200 bg-surface/90 ${
                        isLate
                          ? "border-rose-500/60 bg-rose-950/20 shadow-rose-950/40"
                          : isWarning
                          ? "border-amber-500/50 bg-amber-950/20"
                          : "border-border/80 hover:border-accent/40"
                      }`}
                    >
                      <div className="mb-3 flex items-baseline justify-between gap-3 pb-2 border-b border-border/60">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-lg text-white">
                            {ticket.tableCode ? `Table ${ticket.tableCode}` : ticket.orderType}
                          </span>
                          <span className="font-mono text-xs text-fg-muted">
                            #{ticket.id.slice(0, 6)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 font-mono text-sm font-bold">
                          <Clock className={`size-3.5 ${isLate ? "text-rose-400 animate-pulse" : "text-amber-400"}`} />
                          <span className={isLate ? "text-rose-400 font-extrabold" : "text-amber-300"}>
                            {elapsedLabel(ticket.createdAt, now)}
                          </span>
                        </div>
                      </div>

                      <ul className="space-y-2 mb-4">
                        {ticket.items.map((item) => (
                          <li key={item.id} className="text-sm">
                            <button
                              type="button"
                              className="group flex w-full items-start justify-between rounded-xl p-1.5 text-left transition-colors hover:bg-elevated/70"
                              onClick={() => void cookItem(item.id)}
                            >
                              <div className="min-w-0 pr-2">
                                <span className="font-bold text-accent mr-2">{item.qty}×</span>
                                <span className="font-semibold text-white group-hover:text-amber-300 transition-colors">
                                  {item.name}
                                </span>
                                {item.variantName ? (
                                  <span className="text-xs text-fg-muted ml-1">({item.variantName})</span>
                                ) : null}
                                {item.modifiers.length > 0 ? (
                                  <p className="text-xs text-amber-400/90 pl-6 mt-0.5 font-mono">
                                    + {item.modifiers.join(", ")}
                                  </p>
                                ) : null}
                              </div>

                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                                  item.status === "READY" || item.status === "COOKED"
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : "bg-surface text-fg-muted"
                                }`}
                              >
                                {item.status === "READY" || item.status === "COOKED" ? "Done" : "Line"}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>

                      {ticket.status !== "READY" ? (
                        <Button
                          className="w-full font-bold shadow-md"
                          size="md"
                          variant={ticket.status === "NEW" ? "gradient" : "success"}
                          onClick={() => void bump(ticket)}
                        >
                          {ticket.status === "NEW" ? "Fire / In Progress" : "Pass / Ready"}
                        </Button>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-emerald-400">
                          <CheckCircle2 className="size-4" />
                          Plated & Ready for Server
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
