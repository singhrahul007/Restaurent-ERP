"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AppShell,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Input,
  Select,
  Skeleton,
} from "@niva/ui";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Home,
  Maximize2,
  Minimize2,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tv,
  UserCheck,
  Users,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { ApiError, api } from "../../lib/api";
import { SessionGate } from "../../lib/session-gate";

export type QueueItem = {
  id: string;
  organizationId: string;
  branchId: string;
  guestName: string;
  guestPhone: string;
  partySize: number;
  reservationTime: string;
  tableId: string | null;
  tableCode: string | null;
  status: "WAITLISTED" | "CONFIRMED" | "SEATED" | "CANCELLED" | "NO_SHOW";
  specialRequests: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Table = {
  id: string;
  code: string;
  floor: string | null;
  seats: number | null;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "OUT_OF_SERVICE";
};

export type Branch = {
  id: string;
  name: string;
};

const MUTE_KEY = "niva_queue_mute";

export default function QueuePage() {
  return (
    <SessionGate requiredAnyPermissions={["tables.view", "orders.view", "reservations.view"]}>
      <QueueContent />
    </SessionGate>
  );
}

function QueueContent() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [tables, setTables] = useState<Table[]>([]);
  const [reservations, setReservations] = useState<QueueItem[]>([]);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "WAITLISTED" | "SEATED" | "ARCHIVED">("WAITLISTED");
  const [partySizeFilter, setPartySizeFilter] = useState<string>("ALL");

  // UI Modes & Modals
  const [isTvKioskMode, setIsTvKioskMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [seatModalItem, setSeatModalItem] = useState<QueueItem | null>(null);
  const [selectedSeatTableId, setSelectedSeatTableId] = useState<string>("");
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());

  // New Walk-in Form State
  const [formGuestName, setFormGuestName] = useState("");
  const [formGuestPhone, setFormGuestPhone] = useState("");
  const [formPartySize, setFormPartySize] = useState("2");
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Audio effects
  useEffect(() => {
    try {
      const stored = localStorage.getItem(MUTE_KEY);
      if (stored !== null) setIsMuted(stored === "true");
    } catch {}
  }, []);

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTE_KEY, String(next));
      } catch {}
      return next;
    });
  };

  const playChime = useCallback(() => {
    if (isMuted || typeof window === "undefined") return;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, [isMuted]);

  // Load Organization, Restaurant, Branch, Tables & Queue
  const loadData = useCallback(async (selectedBranch?: string) => {
    try {
      setError(null);
      const me = await api<{
        user: { id: string };
        memberships?: Array<{ organizationId: string }>;
      }>("/auth/me");

      const organizationId =
        me.memberships?.[0]?.organizationId ||
        window.localStorage.getItem("niva_organization_id");

      if (organizationId) {
        window.localStorage.setItem("niva_organization_id", organizationId);
      }

      // Check restaurants
      const restRes = await api<{ restaurants: Array<{ id: string }> }>("/restaurants");
      let restaurantId = restRes.restaurants[0]?.id;
      if (!restaurantId) {
        const createdRest = await api<{ id: string }>("/restaurants", {
          method: "POST",
          body: JSON.stringify({ name: "Primary Restaurant" }),
        });
        restaurantId = createdRest.id;
      }
      window.localStorage.setItem("niva_restaurant_id", restaurantId);

      // Check branches
      const branchRes = await api<{ branches: Branch[] }>(
        `/restaurants/${restaurantId}/branches`,
      );
      setBranches(branchRes.branches);

      let activeBranchId =
        selectedBranch ||
        window.localStorage.getItem("niva_branch_id") ||
        branchRes.branches[0]?.id;

      if (!activeBranchId && branchRes.branches.length === 0) {
        const createdBranch = await api<{ id: string }>(
          `/restaurants/${restaurantId}/branches`,
          {
            method: "POST",
            body: JSON.stringify({ name: "Main Dining" }),
          },
        );
        activeBranchId = createdBranch.id;
        setBranches([{ id: createdBranch.id, name: "Main Dining" }]);
      }

      if (activeBranchId) {
        setBranchId(activeBranchId);
        window.localStorage.setItem("niva_branch_id", activeBranchId);

        // Fetch tables & reservations in parallel
        const [tableData, resData] = await Promise.all([
          api<{ tables: Table[] }>(`/branches/${activeBranchId}/tables`).catch(() => ({
            tables: [],
          })),
          api<{ reservations: QueueItem[] }>(
            `/reservations?branchId=${activeBranchId}`,
          ).catch(() => ({ reservations: [] })),
        ]);

        setTables(tableData.tables);
        setReservations(resData.reservations);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login?from=/queue");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load queue data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh queue every 30 seconds
  useEffect(() => {
    if (!branchId) return;
    const interval = setInterval(() => {
      api<{ reservations: QueueItem[] }>(`/reservations?branchId=${branchId}`)
        .then((res) => setReservations(res.reservations))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [branchId]);

  const handleBranchChange = (newBranchId: string) => {
    setBranchId(newBranchId);
    window.localStorage.setItem("niva_branch_id", newBranchId);
    setRefreshing(true);
    loadData(newBranchId);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(branchId);
  };

  // Create new waitlist token
  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return;
    setSubmitting(true);
    try {
      const party = Math.max(1, parseInt(formPartySize, 10) || 1);
      const nowIso = new Date().toISOString();
      const res = await api<{ reservation: QueueItem }>("/reservations", {
        method: "POST",
        body: JSON.stringify({
          branchId,
          guestName: formGuestName.trim(),
          guestPhone: formGuestPhone.trim(),
          partySize: party,
          reservationTime: nowIso,
          status: "WAITLISTED",
          specialRequests: formNotes.trim() ? formNotes.trim() : undefined,
        }),
      });

      if (res?.reservation) {
        setReservations((prev) => [res.reservation, ...prev]);
      }
      setAddModalOpen(false);
      setFormGuestName("");
      setFormGuestPhone("");
      setFormPartySize("2");
      setFormNotes("");
      playChime();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate token");
    } finally {
      setSubmitting(false);
    }
  };

  // Update status (e.g. SEATED, CANCELLED, NO_SHOW)
  const handleUpdateStatus = async (
    id: string,
    status: "WAITLISTED" | "CONFIRMED" | "SEATED" | "CANCELLED" | "NO_SHOW",
    tableId?: string | null,
  ) => {
    try {
      const payload: Record<string, unknown> = { status };
      if (tableId !== undefined) {
        payload.tableId = tableId;
      }

      await api(`/reservations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setReservations((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status,
                tableId: tableId !== undefined ? tableId : item.tableId,
                tableCode:
                  tableId !== undefined
                    ? tables.find((t) => t.id === tableId)?.code || null
                    : item.tableCode,
              }
            : item,
        ),
      );

      // If seated table, update table status locally or reload
      if (status === "SEATED" && tableId) {
        setTables((prev) =>
          prev.map((t) => (t.id === tableId ? { ...t, status: "OCCUPIED" } : t)),
        );
        playChime();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update reservation status");
    }
  };

  const handleSeatModalSubmit = async () => {
    if (!seatModalItem) return;
    await handleUpdateStatus(
      seatModalItem.id,
      "SEATED",
      selectedSeatTableId || null,
    );
    setSeatModalItem(null);
    setSelectedSeatTableId("");
  };

  const handleSendNotification = (id: string, guestName: string) => {
    setNotifiedIds((prev) => new Set(prev).add(id));
    playChime();
  };

  // Filtered lists
  const filteredList = useMemo(() => {
    return reservations.filter((item) => {
      // Status filter
      if (statusFilter === "WAITLISTED") {
        if (item.status !== "WAITLISTED" && item.status !== "CONFIRMED") return false;
      } else if (statusFilter === "SEATED") {
        if (item.status !== "SEATED") return false;
      } else if (statusFilter === "ARCHIVED") {
        if (item.status !== "CANCELLED" && item.status !== "NO_SHOW") return false;
      }

      // Party size filter
      if (partySizeFilter === "1-2" && item.partySize > 2) return false;
      if (partySizeFilter === "3-4" && (item.partySize < 3 || item.partySize > 4)) return false;
      if (partySizeFilter === "5-6" && (item.partySize < 5 || item.partySize > 6)) return false;
      if (partySizeFilter === "7+" && item.partySize < 7) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.guestName.toLowerCase().includes(q);
        const matchPhone = item.guestPhone.toLowerCase().includes(q);
        const matchTable = item.tableCode?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchTable) return false;
      }

      return true;
    });
  }, [reservations, statusFilter, partySizeFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const activeWaitlist = reservations.filter(
      (r) => r.status === "WAITLISTED" || r.status === "CONFIRMED",
    );
    const seatedToday = reservations.filter((r) => r.status === "SEATED");
    const totalWaitingGuests = activeWaitlist.reduce((sum, r) => sum + r.partySize, 0);

    // Dynamic wait estimate: ~8 mins per party ahead
    const estimatedWaitMinutes = Math.max(5, activeWaitlist.length * 8);

    const availableTables = tables.filter((t) => t.status === "AVAILABLE").length;

    return {
      activeQueueCount: activeWaitlist.length,
      totalWaitingGuests,
      seatedTodayCount: seatedToday.length,
      estimatedWaitMinutes,
      availableTables,
      totalTables: tables.length,
    };
  }, [reservations, tables]);

  // Helper to format minutes elapsed
  const getMinutesWaiting = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    const diff = Math.floor((now - created) / 60000);
    return Math.max(0, diff);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="p-8 max-w-xl mx-auto">
          <ErrorState
            title="Unable to load Queue & Waitlist"
            description={error}
            action={
              <Button onClick={() => loadData(branchId)} variant="primary">
                Retry Connection
              </Button>
            }
          />
        </div>
      </AppShell>
    );
  }

  // --- TV KIOSK / LOBBY CASTING VIEW ---
  if (isTvKioskMode) {
    const waitingTokens = reservations.filter(
      (r) => r.status === "WAITLISTED" || r.status === "CONFIRMED",
    );
    const readyToSeat = waitingTokens.filter((r) => notifiedIds.has(r.id));
    const nowWaiting = waitingTokens.filter((r) => !notifiedIds.has(r.id));

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
        {/* TV Header */}
        <header className="px-8 py-5 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Users className="size-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                Live Guest Waitlist
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                {branches.find((b) => b.id === branchId)?.name || "Main Dining"} &bull; Lobby TV Display
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Est. Turnaround
              </div>
              <div className="text-xl font-bold text-amber-400">
                ~{stats.estimatedWaitMinutes} mins
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={toggleMute}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTvKioskMode(false)}
              className="border-purple-600/50 text-purple-300 hover:bg-purple-950/40 flex items-center gap-1.5"
            >
              <Minimize2 className="size-4" />
              Exit Kiosk
            </Button>
          </div>
        </header>

        {/* TV Content Grid */}
        <main className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-hidden">
          {/* Section 1: Ready to Seat / Announced */}
          <section className="bg-slate-900/40 border border-emerald-500/30 rounded-2xl p-6 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-emerald-500/20 mb-4">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-lg tracking-wide uppercase">
                <Bell className="size-5 animate-bounce" />
                Now Calling to Host Counter
              </div>
              <Badge variant="success" size="lg">
                {readyToSeat.length} Ready
              </Badge>
            </div>

            {readyToSeat.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                <Sparkles className="size-12 mb-3 stroke-[1.5] text-slate-600" />
                <p className="text-lg font-medium text-slate-400">Tables being prepared</p>
                <p className="text-sm">Tokens called will flash here with sound</p>
              </div>
            ) : (
              <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-250px)] pr-2">
                {readyToSeat.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border-2 border-emerald-500/60 shadow-lg shadow-emerald-950/40 flex items-center justify-between animate-pulse"
                  >
                    <div>
                      <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold">
                        Token #{item.id.slice(-4).toUpperCase()}
                      </div>
                      <div className="text-2xl font-bold text-white mt-1">
                        {item.guestName}
                      </div>
                      <div className="text-sm text-emerald-300/80 mt-0.5">
                        Party of {item.partySize} guests
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-sm border border-emerald-500/40">
                        {item.tableCode ? `Table ${item.tableCode}` : "Proceed to Host"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 2: Waiting Queue List */}
          <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-slate-300 font-semibold text-lg tracking-wide uppercase">
                <Clock className="size-5 text-purple-400" />
                Active Queue Order
              </div>
              <Badge variant="purple" size="lg">
                {nowWaiting.length} In Line
              </Badge>
            </div>

            {nowWaiting.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                <CheckCircle2 className="size-12 mb-3 stroke-[1.5] text-slate-600" />
                <p className="text-lg font-medium text-slate-400">No waitlist currently!</p>
                <p className="text-sm">Walk-in guests can be seated immediately.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto max-h-[calc(100vh-250px)] pr-2">
                {nowWaiting.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs uppercase font-mono text-purple-400 font-semibold">
                        #{idx + 1} &bull; Token {item.id.slice(-4).toUpperCase()}
                      </div>
                      <div className="text-lg font-semibold text-slate-200 mt-0.5 truncate max-w-[150px]">
                        {item.guestName}
                      </div>
                      <div className="text-xs text-slate-400">
                        Party of {item.partySize}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Wait time</div>
                      <div className="text-sm font-semibold text-amber-400">
                        {getMinutesWaiting(item.createdAt)}m
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  // --- STANDARD HOST MANAGEMENT WORKSPACE ---
  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Top Control Bar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
                <Home className="size-3.5" />
                Hub
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-1.5 text-fg-muted">
                <ArrowLeft className="size-4" />
                Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-border hidden sm:block" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-fg flex items-center gap-2">
                Queue & Waitlist
                <Badge variant="purple" size="sm">
                  Live Tokens
                </Badge>
              </h1>
              <p className="text-xs text-fg-muted">
                Manage walk-ins, estimated waiting times, seating alerts, and lobby kiosk.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {branches.length > 1 && (
              <Select
                value={branchId}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="w-44 text-xs"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={toggleMute}
              className="text-fg-muted hover:text-fg"
            >
              {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTvKioskMode(true)}
              className="gap-1.5 text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
            >
              <Tv className="size-4" />
              Lobby TV Kiosk
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setAddModalOpen(true)}
              className="gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium"
            >
              <Plus className="size-4" />
              Issue Token
            </Button>
          </div>
        </header>

        {/* Realtime Statistics Banner */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-indigo-500/5 border-purple-500/20">
            <div className="flex items-center justify-between text-fg-muted text-xs font-semibold uppercase tracking-wider">
              <span>Active Waitlist</span>
              <Users className="size-4 text-purple-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-fg">
              {stats.activeQueueCount} <span className="text-xs font-normal text-fg-muted">parties</span>
            </div>
            <p className="text-[11px] text-fg-muted mt-1">
              {stats.totalWaitingGuests} total guests waiting to be seated
            </p>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20">
            <div className="flex items-center justify-between text-fg-muted text-xs font-semibold uppercase tracking-wider">
              <span>Est. Wait Time</span>
              <Clock className="size-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-400">
              ~{stats.estimatedWaitMinutes} <span className="text-xs font-normal text-fg-muted">mins</span>
            </div>
            <p className="text-[11px] text-fg-muted mt-1">
              Dynamic turnaround estimate
            </p>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/20">
            <div className="flex items-center justify-between text-fg-muted text-xs font-semibold uppercase tracking-wider">
              <span>Table Availability</span>
              <UtensilsCrossed className="size-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-400">
              {stats.availableTables} / {stats.totalTables}
            </div>
            <p className="text-[11px] text-fg-muted mt-1">
              Free dining tables ready for turnover
            </p>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/20">
            <div className="flex items-center justify-between text-fg-muted text-xs font-semibold uppercase tracking-wider">
              <span>Seated Today</span>
              <UserCheck className="size-4 text-blue-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-400">
              {stats.seatedTodayCount}
            </div>
            <p className="text-[11px] text-fg-muted mt-1">
              Parties served & seated
            </p>
          </Card>
        </section>

        {/* Filter and Tab Controls */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
          {/* Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setStatusFilter("WAITLISTED")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                statusFilter === "WAITLISTED"
                  ? "bg-purple-600 text-white"
                  : "text-fg-muted hover:text-fg hover:bg-muted"
              }`}
            >
              <span>Waiting Tokens</span>
              <Badge variant="purple" size="sm">
                {stats.activeQueueCount}
              </Badge>
            </button>
            <button
              onClick={() => setStatusFilter("SEATED")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                statusFilter === "SEATED"
                  ? "bg-purple-600 text-white"
                  : "text-fg-muted hover:text-fg hover:bg-muted"
              }`}
            >
              <span>Seated</span>
              <Badge variant="default" size="sm">
                {stats.seatedTodayCount}
              </Badge>
            </button>
            <button
              onClick={() => setStatusFilter("ARCHIVED")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === "ARCHIVED"
                  ? "bg-purple-600 text-white"
                  : "text-fg-muted hover:text-fg hover:bg-muted"
              }`}
            >
              Cancelled / No Show
            </button>
          </div>

          {/* Search & Party Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="size-3.5 absolute left-3 top-2.5 text-fg-muted" />
              <input
                type="text"
                placeholder="Search guest or token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-purple-500 w-44 sm:w-56"
              />
            </div>

            <Select
              value={partySizeFilter}
              onChange={(e) => setPartySizeFilter(e.target.value)}
              className="text-xs py-1.5 w-32"
            >
              <option value="ALL">All Sizes</option>
              <option value="1-2">1-2 Guests</option>
              <option value="3-4">3-4 Guests</option>
              <option value="5-6">5-6 Guests</option>
              <option value="7+">7+ Guests</option>
            </Select>
          </div>
        </section>

        {/* Tokens List / Queue Cards */}
        {filteredList.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-border rounded-xl">
            <Users className="size-10 mx-auto text-fg-muted stroke-[1.5] mb-2" />
            <h3 className="text-base font-semibold text-fg">No Queue Tokens Found</h3>
            <p className="text-xs text-fg-muted max-w-sm mx-auto mt-1">
              {statusFilter === "WAITLISTED"
                ? "There are currently no waiting parties in the queue. Issue a new walk-in token to get started."
                : "No matching records found for the selected filter."}
            </p>
            {statusFilter === "WAITLISTED" && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setAddModalOpen(true)}
                className="mt-4 gap-1.5"
              >
                <Plus className="size-4" />
                Issue Token
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredList.map((item, idx) => {
              const minutes = getMinutesWaiting(item.createdAt);
              const isNotified = notifiedIds.has(item.id);
              const isWaiting = item.status === "WAITLISTED" || item.status === "CONFIRMED";

              return (
                <Card
                  key={item.id}
                  className={`p-4 flex flex-col justify-between transition-all ${
                    isNotified
                      ? "border-emerald-500/50 bg-emerald-500/5 shadow-md shadow-emerald-500/5"
                      : "border-border hover:border-border-strong"
                  }`}
                >
                  <div>
                    {/* Header: Token #, Badge, Time */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 font-mono text-xs font-bold border border-purple-500/30">
                          #{item.id.slice(-4).toUpperCase()}
                        </span>
                        <Badge
                          variant={
                            item.status === "SEATED"
                              ? "success"
                              : item.status === "CANCELLED"
                              ? "danger"
                              : item.status === "NO_SHOW"
                              ? "default"
                              : isNotified
                              ? "success"
                              : "purple"
                          }
                          size="sm"
                        >
                          {item.status === "SEATED"
                            ? "Seated"
                            : item.status === "CANCELLED"
                            ? "Cancelled"
                            : item.status === "NO_SHOW"
                            ? "No Show"
                            : isNotified
                            ? "Alerted / Ready"
                            : "Waiting"}
                        </Badge>
                      </div>

                      {isWaiting && (
                        <div className="flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                          <Clock className="size-3" />
                          <span>{minutes}m waiting</span>
                        </div>
                      )}
                    </div>

                    {/* Guest Details */}
                    <div className="mt-3">
                      <h4 className="text-base font-semibold text-fg tracking-tight">
                        {item.guestName}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-fg-muted mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="size-3.5 text-purple-400" />
                          {item.partySize} {item.partySize === 1 ? "Guest" : "Guests"}
                        </span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <Phone className="size-3.5 text-fg-muted" />
                          {item.guestPhone}
                        </span>
                      </div>

                      {item.specialRequests && (
                        <div className="mt-2 text-xs p-2 rounded-lg bg-muted/60 text-fg-muted border border-border">
                          <span className="font-medium text-fg">Notes:</span> {item.specialRequests}
                        </div>
                      )}

                      {item.tableCode && (
                        <div className="mt-2 text-xs text-emerald-400 font-medium flex items-center gap-1">
                          <UtensilsCrossed className="size-3.5" />
                          Assigned Table: {item.tableCode}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  {isWaiting && (
                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant={isNotified ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => handleSendNotification(item.id, item.guestName)}
                          className="text-xs gap-1"
                        >
                          <Bell className={`size-3.5 ${isNotified ? "text-emerald-400" : ""}`} />
                          {isNotified ? "Re-alert" : "Alert SMS"}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUpdateStatus(item.id, "NO_SHOW")}
                          className="text-xs text-fg-muted hover:text-rose-400"
                          title="Mark No Show"
                        >
                          <XCircle className="size-3.5" />
                        </Button>
                      </div>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setSeatModalItem(item);
                          setSelectedSeatTableId(item.tableId || "");
                        }}
                        className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        <UserCheck className="size-3.5" />
                        Seat Table
                      </Button>
                    </div>
                  )}

                  {!isWaiting && (
                    <div className="mt-4 pt-2 border-t border-border flex items-center justify-between text-xs text-fg-muted">
                      <span>Updated: {new Date(item.updatedAt).toLocaleTimeString()}</span>
                      {item.status !== "WAITLISTED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUpdateStatus(item.id, "WAITLISTED")}
                          className="text-[11px] text-purple-400 hover:underline p-0 h-auto"
                        >
                          Reopen Token
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Issue Walk-in Token Dialog Modal */}
        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md bg-elevated border-border shadow-xl">
            <DialogHeader>
              <DialogTitle>Issue Walk-in Queue Token</DialogTitle>
              <DialogDescription>
                Register walk-in party and generate digital queue token.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateToken} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Guest Name *
                </label>
                <Input
                  type="text"
                  placeholder="e.g. John Doe"
                  required
                  value={formGuestName}
                  onChange={(e) => setFormGuestName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">
                    Phone Number *
                  </label>
                  <Input
                    type="tel"
                    placeholder="e.g. +1 555-0199"
                    required
                    value={formGuestPhone}
                    onChange={(e) => setFormGuestPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">
                    Party Size (Guests) *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={formPartySize}
                    onChange={(e) => setFormPartySize(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Seating Preferences / Special Requests
                </label>
                <Input
                  type="text"
                  placeholder="e.g. High chair, booth preferred, wheelchair access"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
                <span className="font-semibold">Turnaround guidance:</span> Estimated wait time for a party of {formPartySize || 2} is approx{" "}
                <strong className="text-amber-300">~{stats.estimatedWaitMinutes} mins</strong>.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submitting}
                  className="bg-purple-600 hover:bg-purple-500 text-white"
                >
                  {submitting ? "Generating..." : "Generate Token"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Seat Table Assignment Dialog */}
        <Dialog open={!!seatModalItem} onOpenChange={(open) => !open && setSeatModalItem(null)}>
          <DialogContent className="max-w-md bg-elevated border-border shadow-xl">
            <DialogHeader>
              <DialogTitle>Seat Guest Party</DialogTitle>
              <DialogDescription>
                Assign dining table and mark token as seated.
              </DialogDescription>
            </DialogHeader>

            {seatModalItem && (
              <div className="space-y-4 pt-2">
                <div className="p-3 rounded-xl bg-card border border-border">
                  <div className="text-xs uppercase text-purple-400 font-bold">
                    Token #{seatModalItem.id.slice(-4).toUpperCase()}
                  </div>
                  <div className="text-lg font-bold text-fg mt-0.5">
                    {seatModalItem.guestName}
                  </div>
                  <div className="text-xs text-fg-muted mt-1">
                    Party of {seatModalItem.partySize} &bull; Waited{" "}
                    {getMinutesWaiting(seatModalItem.createdAt)} mins
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">
                    Assign Dining Table
                  </label>
                  <Select
                    value={selectedSeatTableId}
                    onChange={(e) => setSelectedSeatTableId(e.target.value)}
                    className="w-full text-xs"
                  >
                    <option value="">-- No specific table / Free Seating --</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        Table {t.code} ({t.seats || 2} seats, {t.floor || "Main Floor"}) &mdash; {t.status}
                      </option>
                    ))}
                  </Select>
                  <p className="text-[11px] text-fg-muted mt-1">
                    Selecting a table will mark it occupied in the dining system.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSeatModalItem(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSeatModalSubmit}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Confirm & Seat Now
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

