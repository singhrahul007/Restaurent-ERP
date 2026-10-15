"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Layers,
  Sparkles,
  UserCheck,
  Users,
  UtensilsCrossed,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ApiError, api } from "../../lib/api";

export type TicketItem = {
  id: string;
  name: string;
  variantName: string | null;
  qty: number;
  modifiers: string[];
  status: "PENDING" | "IN_PROGRESS" | "READY" | string;
  kitchenStationId?: string | null;
  assignedCookId?: string | null;
  assignedCookName?: string | null;
  claimedAt?: string | null;
};

export type Ticket = {
  id: string;
  orderId: string;
  status: "NEW" | "IN_PROGRESS" | "READY" | string;
  orderType: string;
  tableCode: string | null;
  createdAt: string;
  items: TicketItem[];
};

export type KitchenStation = {
  id: string;
  name: string;
  code: string;
  colorHex: string;
  sortOrder: number;
};

type Columns = { NEW: Ticket[]; IN_PROGRESS: Ticket[]; READY: Ticket[] };

const MUTE_KEY = "niva_kds_mute";
const STATION_FILTER_KEY = "niva_kds_station_filter";
const VIEW_MODE_KEY = "niva_kds_view_mode";

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
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [activeStationId, setActiveStationId] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"board" | "all_day">("board");
  const [currentUser, setCurrentUser] = useState<{ id: string; fullName: string | null } | null>(null);
  const [filterMyClaimsOnly, setFilterMyClaimsOnly] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [muted, setMuted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const load = useCallback(async () => {
    try {
      const me = await api<{
        id: string;
        fullName?: string | null;
        memberships: Array<{ organizationId: string }>;
      }>("/auth/me");
      if (me?.id) {
        setCurrentUser({ id: me.id, fullName: me.fullName ?? "Me (Cook)" });
      }
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

      const [ticketsRes, stationsRes] = await Promise.all([
        api<{ columns: Columns }>(`/branches/${branchId}/kitchen/tickets`),
        api<KitchenStation[]>(`/branches/${branchId}/kitchen/stations`).catch(() => []),
      ]);

      setColumns(ticketsRes.columns ?? { NEW: [], IN_PROGRESS: [], READY: [] });
      setStations(Array.isArray(stationsRes) ? stationsRes : []);
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
    const rawMute = window.localStorage.getItem(MUTE_KEY);
    if (rawMute !== null) {
      setMuted(rawMute === "true");
    }
    const rawStation = window.localStorage.getItem(STATION_FILTER_KEY);
    if (rawStation) {
      setActiveStationId(rawStation);
    }
    const rawViewMode = window.localStorage.getItem(VIEW_MODE_KEY);
    if (rawViewMode === "all_day" || rawViewMode === "board") {
      setViewMode(rawViewMode);
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

  function handleSelectStation(id: string) {
    setActiveStationId(id);
    window.localStorage.setItem(STATION_FILTER_KEY, id);
  }

  function handleSelectViewMode(mode: "board" | "all_day") {
    setViewMode(mode);
    window.localStorage.setItem(VIEW_MODE_KEY, mode);
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

  async function toggleClaimItem(item: TicketItem) {
    if (!currentUser) return;
    try {
      const isClaimedByMe = item.assignedCookId === currentUser.id;
      await api(`/kitchen/ticket-items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          assignedCookId: isClaimedByMe ? null : currentUser.id,
          status: isClaimedByMe ? "PENDING" : "IN_PROGRESS",
        }),
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

  // Filter columns based on station & claim
  const filteredColumns = useMemo(() => {
    const filterTicket = (ticket: Ticket): Ticket | null => {
      let items = ticket.items;

      if (activeStationId !== "ALL") {
        items = items.filter((item) => item.kitchenStationId === activeStationId);
      }

      if (filterMyClaimsOnly && currentUser) {
        items = items.filter((item) => item.assignedCookId === currentUser.id);
      }

      if (items.length === 0 && (activeStationId !== "ALL" || filterMyClaimsOnly)) {
        return null;
      }

      return {
        ...ticket,
        items,
      };
    };

    return {
      NEW: columns.NEW.map(filterTicket).filter((t): t is Ticket => t !== null),
      IN_PROGRESS: columns.IN_PROGRESS.map(filterTicket).filter((t): t is Ticket => t !== null),
      READY: columns.READY.map(filterTicket).filter((t): t is Ticket => t !== null),
    };
  }, [columns, activeStationId, filterMyClaimsOnly, currentUser]);

  // Aggregated "All Day" prep item count across active tickets
  const allDayItems = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; pendingCount: number; readyCount: number }>();
    const activeTickets = [...filteredColumns.NEW, ...filteredColumns.IN_PROGRESS];

    for (const ticket of activeTickets) {
      for (const item of ticket.items) {
        const key = item.variantName ? `${item.name} (${item.variantName})` : item.name;
        const entry = map.get(key) ?? {
          name: key,
          qty: 0,
          pendingCount: 0,
          readyCount: 0,
        };
        entry.qty += item.qty;
        if (item.status === "READY") {
          entry.readyCount += item.qty;
        } else {
          entry.pendingCount += item.qty;
        }
        map.set(key, entry);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [filteredColumns]);

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
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-border/80 bg-surface/60 backdrop-blur-md rounded-2xl p-4">
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
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">Kitchen Display System (KDS)</h1>
                <Badge variant="default" size="sm" className="font-mono">
                  Multi-Cook
                </Badge>
              </div>
              <p className="text-xs text-fg-muted font-mono">Live Line Station Expediter & Dispatch</p>
            </div>
          </div>
        </div>

        {/* Cook & Station Switcher Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Station Pills */}
          <div className="flex items-center rounded-xl border border-border/80 bg-surface/80 p-1">
            <button
              type="button"
              onClick={() => handleSelectStation("ALL")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                activeStationId === "ALL"
                  ? "bg-amber-500 text-black shadow-sm"
                  : "text-fg-secondary hover:text-fg-primary"
              }`}
            >
              All Stations
            </button>
            {stations.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => handleSelectStation(st.id)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  activeStationId === st.id
                    ? "bg-amber-500 text-black shadow-sm"
                    : "text-fg-secondary hover:text-fg-primary"
                }`}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: st.colorHex ?? "#f59e0b" }}
                />
                {st.name}
              </button>
            ))}
          </div>

          {/* My Claims Filter Toggle */}
          {currentUser ? (
            <button
              type="button"
              onClick={() => setFilterMyClaimsOnly((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                filterMyClaimsOnly
                  ? "border-amber-500 bg-amber-500/20 text-amber-300"
                  : "border-border bg-surface text-fg-secondary hover:text-fg-primary"
              }`}
            >
              <UserCheck className="size-3.5" />
              <span>My Tasks</span>
            </button>
          ) : null}

          {/* Mode Switcher: Board vs All-Day Aggregator */}
          <div className="flex items-center rounded-xl border border-border/80 bg-surface/80 p-1">
            <button
              type="button"
              onClick={() => handleSelectViewMode("board")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                viewMode === "board"
                  ? "bg-surface-elevated text-white border border-border/60 shadow-sm"
                  : "text-fg-secondary hover:text-fg-primary"
              }`}
            >
              <Layers className="size-3.5" />
              Board
            </button>
            <button
              type="button"
              onClick={() => handleSelectViewMode("all_day")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                viewMode === "all_day"
                  ? "bg-surface-elevated text-white border border-border/60 shadow-sm"
                  : "text-fg-secondary hover:text-fg-primary"
              }`}
            >
              <UtensilsCrossed className="size-3.5" />
              All-Day ({allDayItems.reduce((acc, curr) => acc + curr.pendingCount, 0)})
            </button>
          </div>

          <Badge variant="success" dot pulse size="sm">
            Live Synced
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

      {/* VIEW: All-Day Prep Summary */}
      {viewMode === "all_day" ? (
        <div className="rounded-2xl border border-border/80 bg-surface/50 backdrop-blur-md p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="size-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">All-Day Kitchen Aggregator</h2>
              <span className="text-xs text-fg-muted font-mono">
                Total item quantities queued across active tickets
              </span>
            </div>
            <Badge variant="info">
              {allDayItems.length} Distinct Dishes
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allDayItems.length === 0 ? (
              <div className="col-span-full py-16 text-center text-fg-muted">
                No active orders on the line right now.
              </div>
            ) : (
              allDayItems.map((item) => (
                <div
                  key={item.name}
                  className="rounded-xl border border-border/70 bg-surface/90 p-4 shadow-sm flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-bold text-white text-base">{item.name}</h3>
                    <p className="text-xs text-fg-muted mt-0.5">
                      {item.readyCount > 0 ? `${item.readyCount} ready / ` : ""}
                      <span className="text-amber-400 font-semibold">{item.pendingCount} to fire</span>
                    </p>
                  </div>
                  <div className="flex items-center justify-center size-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-extrabold text-xl">
                    {item.pendingCount}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* VIEW: 3 Columns Kanban Board */
        <div className="grid min-h-[calc(100vh-8.5rem)] grid-cols-1 gap-4 lg:grid-cols-3">
          {boards.map((board) => {
            const Icon = board.icon;
            const ticketList = filteredColumns[board.key] ?? [];
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
                      <p className="text-xs">No tickets in this section</p>
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

                        <ul className="space-y-2.5 mb-4">
                          {ticket.items.map((item) => {
                            const isAssignedToMe = currentUser && item.assignedCookId === currentUser.id;
                            const isClaimedByOther = item.assignedCookId && !isAssignedToMe;

                            return (
                              <li
                                key={item.id}
                                className={`rounded-xl border p-2 text-sm transition-all ${
                                  isAssignedToMe
                                    ? "border-amber-500/40 bg-amber-500/10"
                                    : "border-border/50 bg-surface/60"
                                }`}
                              >
                                <div className="flex w-full items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="font-bold text-accent">{item.qty}×</span>
                                      <span className="font-semibold text-white">
                                        {item.name}
                                      </span>
                                      {item.variantName ? (
                                        <span className="text-xs text-fg-muted">({item.variantName})</span>
                                      ) : null}
                                    </div>
                                    {item.modifiers.length > 0 ? (
                                      <p className="text-xs text-amber-400/90 pl-6 mt-0.5 font-mono">
                                        + {item.modifiers.join(", ")}
                                      </p>
                                    ) : null}

                                    {/* Cook assignment indicator */}
                                    <div className="mt-1 flex items-center gap-2">
                                      {item.assignedCookName ? (
                                        <span className="inline-flex items-center gap-1 rounded bg-elevated px-1.5 py-0.5 text-[10px] font-mono text-fg-secondary border border-border/50">
                                          <Users className="size-2.5" />
                                          {isAssignedToMe ? "You" : item.assignedCookName}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {/* Claim / Release button */}
                                    {currentUser && item.status !== "READY" ? (
                                      <button
                                        type="button"
                                        onClick={() => void toggleClaimItem(item)}
                                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold border transition-colors ${
                                          isAssignedToMe
                                            ? "border-amber-500/50 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                                            : isClaimedByOther
                                            ? "border-border bg-surface text-fg-muted hover:text-fg-secondary"
                                            : "border-border bg-surface hover:border-amber-500/40 text-fg-secondary hover:text-white"
                                        }`}
                                        title={isAssignedToMe ? "Release task" : "Claim this item"}
                                      >
                                        {isAssignedToMe ? "Assigned" : "Claim"}
                                      </button>
                                    ) : null}

                                    {/* Item Status button */}
                                    <button
                                      type="button"
                                      disabled={item.status === "READY"}
                                      onClick={() => void cookItem(item.id)}
                                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                                        item.status === "READY"
                                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                          : "bg-surface hover:bg-emerald-500/10 hover:text-emerald-300 text-fg-muted border border-border"
                                      }`}
                                    >
                                      {item.status === "READY" ? "Done" : "Mark Done"}
                                    </button>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
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
      )}
    </AppShell>
  );
}
