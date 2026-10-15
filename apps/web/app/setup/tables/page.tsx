"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Armchair,
  Building2,
  Check,
  Edit2,
  Filter,
  Grid3X3,
  Layers,
  LayoutGrid,
  List,
  MapPin,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  Label,
  PageHeader,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@niva/ui";
import { ApiError, api } from "../../../lib/api";

type Branch = { id: string; name: string };
type DiningTable = {
  id: string;
  code: string;
  floor: string | null;
  seats: number | null;
  status?: string;
};

const PRESET_FLOORS = ["Main Dining", "Ground Floor", "Outdoor Patio", "Rooftop Terrace", "Bar Lounge", "VIP Room"];
const SEAT_PRESETS = [2, 4, 6, 8, 10];

export default function TablesSetupPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("Could not load tables");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Create Table Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [floor, setFloor] = useState("");
  const [seats, setSeats] = useState<number>(4);
  const [creating, setCreating] = useState(false);

  // Edit Table Modal
  const [editingTable, setEditingTable] = useState<DiningTable | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editFloor, setEditFloor] = useState("");
  const [editSeats, setEditSeats] = useState<number>(4);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Table Modal
  const [deletingTable, setDeletingTable] = useState<DiningTable | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadBranches() {
    let restaurantId = window.localStorage.getItem("niva_restaurant_id");
    if (!restaurantId) {
      try {
        const data = await api<{ restaurants: Array<{ id: string }> }>("/restaurants");
        if (data.restaurants[0]) {
          restaurantId = data.restaurants[0].id;
          window.localStorage.setItem("niva_restaurant_id", restaurantId);
        }
      } catch {
        // Handled below
      }
    }
    if (!restaurantId) {
      setStatus("error");
      setError("Please set up or select a restaurant first.");
      return;
    }

    try {
      const data = await api<{ branches: Branch[] }>(`/restaurants/${restaurantId}/branches`);
      setBranches(data.branches);
      const activeId = window.localStorage.getItem("niva_branch_id");
      const defaultBranch =
        data.branches.find((b) => b.id === activeId)?.id ?? data.branches[0]?.id ?? "";
      setBranchId((current) => current || defaultBranch);
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load branches");
      setStatus("error");
    }
  }

  async function loadTables(id: string) {
    if (!id) {
      setTables([]);
      return;
    }
    try {
      const data = await api<{ tables: DiningTable[] }>(`/branches/${id}/tables`);
      setTables(data.tables);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Failed to load tables");
    }
  }

  useEffect(() => {
    void loadBranches();
  }, []);

  useEffect(() => {
    if (branchId) {
      void loadTables(branchId);
    }
  }, [branchId]);

  async function handleAddTable(event: FormEvent) {
    event.preventDefault();
    if (!branchId || !code.trim()) return;

    setCreating(true);
    try {
      await api(`/branches/${branchId}/tables`, {
        method: "POST",
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          floor: floor.trim() || undefined,
          seats: Number(seats) || undefined,
        }),
      });
      setCode("");
      setFloor("");
      setSeats(4);
      setCreateOpen(false);
      toast.success(`Table "${code.toUpperCase()}" added`);
      await loadTables(branchId);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not add table");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(table: DiningTable) {
    setEditingTable(table);
    setEditCode(table.code);
    setEditFloor(table.floor ?? "");
    setEditSeats(table.seats ?? 4);
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingTable || !editCode.trim()) return;

    setSavingEdit(true);
    try {
      await api(`/tables/${editingTable.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          code: editCode.trim().toUpperCase(),
          floor: editFloor.trim() || null,
          seats: Number(editSeats) || null,
        }),
      });
      toast.success("Table updated");
      setEditingTable(null);
      await loadTables(branchId);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not update table");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteTable() {
    if (!deletingTable) return;

    setDeleting(true);
    try {
      await api(`/tables/${deletingTable.id}`, {
        method: "DELETE",
      });
      toast.success(`Table "${deletingTable.code}" removed`);
      setDeletingTable(null);
      await loadTables(branchId);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not delete table");
    } finally {
      setDeleting(false);
    }
  }

  // Floors list for filtering
  const existingFloors = Array.from(
    new Set(tables.map((t) => t.floor?.trim()).filter(Boolean) as string[]),
  );

  const filteredTables = tables.filter((t) => {
    const matchesSearch = t.code.toLowerCase().includes(searchQuery.toLowerCase().trim());
    const matchesFloor =
      selectedFloor === "ALL"
        ? true
        : selectedFloor === "UNASSIGNED"
          ? !t.floor
          : t.floor?.trim() === selectedFloor;
    return matchesSearch && matchesFloor;
  });

  const totalSeats = tables.reduce((acc, curr) => acc + (curr.seats || 0), 0);
  const activeBranch = branches.find((b) => b.id === branchId);

  if (status === "loading") {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (status === "error") {
    return <ErrorState description={error} onRetry={() => void loadBranches()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dining Tables & Floor Plan"
        description="Configure table layouts, seat capacities, and floor zones for POS dine-in service."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* Branch Selector */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 shadow-sm">
              <Building2 className="size-4 text-accent" />
              <select
                aria-label="Select Branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-fg-primary outline-none cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-surface text-fg-primary">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="size-4" />
              Add Table
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Armchair className="size-5" />
            </div>
            <div>
              <p className="text-xs text-fg-muted font-medium">Total Tables</p>
              <p className="text-xl font-bold text-fg-primary">{tables.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-xs text-fg-muted font-medium">Total Dining Capacity</p>
              <p className="text-xl font-bold text-fg-primary">
                {totalSeats} <span className="text-xs font-normal text-fg-muted">guests</span>
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
              <Layers className="size-5" />
            </div>
            <div>
              <p className="text-xs text-fg-muted font-medium">Floor Zones</p>
              <p className="text-xl font-bold text-fg-primary">
                {existingFloors.length || 1} <span className="text-xs font-normal text-fg-muted">sections</span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Floor Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Floor Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedFloor("ALL")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedFloor === "ALL"
                ? "bg-accent text-white shadow-sm"
                : "bg-surface border border-border text-fg-secondary hover:text-fg-primary"
            }`}
          >
            All Floors ({tables.length})
          </button>
          {existingFloors.map((fl) => {
            const count = tables.filter((t) => t.floor?.trim() === fl).length;
            return (
              <button
                key={fl}
                type="button"
                onClick={() => setSelectedFloor(fl)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  selectedFloor === fl
                    ? "bg-accent text-white shadow-sm"
                    : "bg-surface border border-border text-fg-secondary hover:text-fg-primary"
                }`}
              >
                {fl} ({count})
              </button>
            );
          })}
        </div>

        {/* Search & View Switcher */}
        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-60">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-muted" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table code…"
              className="h-8.5 pl-8 text-xs"
            />
          </div>

          <div className="flex items-center rounded-lg border border-border bg-surface p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`rounded p-1.5 transition ${
                viewMode === "grid" ? "bg-elevated text-fg-primary shadow-sm" : "text-fg-muted hover:text-fg-primary"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`rounded p-1.5 transition ${
                viewMode === "table" ? "bg-elevated text-fg-primary shadow-sm" : "text-fg-muted hover:text-fg-primary"
              }`}
              title="List View"
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredTables.length === 0 ? (
        <EmptyState
          title={searchQuery ? "No matching tables" : "No tables on this floor"}
          description={
            searchQuery
              ? `No table matching "${searchQuery}" found in ${activeBranch?.name ?? "this branch"}.`
              : "Add tables with seating capacities to start seating guests in POS."
          }
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="size-4" /> Add Table
            </Button>
          }
        />
      ) : viewMode === "grid" ? (
        /* VISUAL FLOOR GRID */
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredTables.map((table) => (
            <Card
              key={table.id}
              className="group relative flex flex-col justify-between overflow-hidden border-border/80 bg-surface/80 p-4 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-md)]"
            >
              {/* Floor badge watermark */}
              <div className="flex items-start justify-between">
                <span className="truncate text-[11px] font-medium text-fg-muted">
                  {table.floor || "General"}
                </span>
                <Badge variant="primary" size="sm" className="font-mono text-[10px]">
                  {table.seats ? `${table.seats}p` : "—"}
                </Badge>
              </div>

              {/* Table Center Avatar */}
              <div className="my-3 flex flex-col items-center justify-center text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-elevated to-surface shadow-inner group-hover:border-accent/50 group-hover:from-accent/10">
                  <span className="font-mono text-lg font-bold text-fg-primary group-hover:text-accent">
                    {table.code}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-fg-muted">
                  <Users className="size-3 text-fg-muted" />
                  <span>{table.seats ? `${table.seats} Seats` : "Unspecified"}</span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                <button
                  type="button"
                  onClick={() => openEdit(table)}
                  className="flex items-center gap-1 text-xs text-fg-muted transition hover:text-accent"
                >
                  <Edit2 className="size-3" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingTable(table)}
                  className="flex items-center gap-1 text-xs text-fg-muted transition hover:text-danger"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Table Code</TableHead>
              <TableHead>Floor / Section</TableHead>
              <TableHead>Seats Capacity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTables.map((table) => (
              <TableRow key={table.id}>
                <TableCell className="font-mono font-bold text-fg-primary">
                  {table.code}
                </TableCell>
                <TableCell>
                  <Badge variant="default" size="sm">
                    {table.floor ?? "General Area"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5 text-sm">
                    <Users className="size-3.5 text-fg-muted" />
                    {table.seats ? `${table.seats} Persons` : "—"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(table)}
                      className="h-8 gap-1 text-xs"
                    >
                      <Edit2 className="size-3.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeletingTable(table)}
                      className="h-8 text-xs text-danger/80 hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* ADD TABLE DIALOG */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Dining Table</DialogTitle>
            <DialogDescription>
              Assign a unique code and seating capacity for {activeBranch?.name ?? "this branch"}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddTable} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="table-code">Table Code</Label>
              <Input
                id="table-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. T-01, T-02, BAR-1, VIP"
                className="font-mono uppercase font-semibold"
                required
                autoFocus
              />
              <p className="text-xs text-fg-muted">Short identifier displayed on POS and orders.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="table-floor">Floor / Zone</Label>
              <Input
                id="table-floor"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="e.g. Main Dining, Rooftop, Terrace"
              />
              {/* Floor Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PRESET_FLOORS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFloor(p)}
                    className="rounded bg-elevated px-2 py-0.5 text-[11px] text-fg-secondary hover:bg-accent/15 hover:text-accent border border-border/80"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="table-seats">Seating Capacity</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="table-seats"
                  type="number"
                  min={1}
                  max={99}
                  value={seats}
                  onChange={(e) => setSeats(Number(e.target.value) || 2)}
                  className="w-24"
                  required
                />
                <div className="flex flex-wrap gap-1">
                  {SEAT_PRESETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeats(s)}
                      className={`rounded px-2.5 py-1 text-xs font-medium border ${
                        seats === s
                          ? "border-accent bg-accent/20 text-accent"
                          : "border-border bg-surface text-fg-secondary hover:border-accent/40"
                      }`}
                    >
                      {s} seats
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" size="sm" disabled={creating || !code.trim()}>
                {creating ? "Adding…" : "Add Table"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT TABLE DIALOG */}
      <Dialog
        open={Boolean(editingTable)}
        onOpenChange={(open) => !open && setEditingTable(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Table {editingTable?.code}</DialogTitle>
            <DialogDescription>Modify code, floor section, or seating capacity.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-table-code">Table Code</Label>
              <Input
                id="edit-table-code"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                className="font-mono uppercase font-semibold"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-table-floor">Floor / Zone</Label>
              <Input
                id="edit-table-floor"
                value={editFloor}
                onChange={(e) => setEditFloor(e.target.value)}
                placeholder="e.g. Main Dining, Patio"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PRESET_FLOORS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEditFloor(p)}
                    className="rounded bg-elevated px-2 py-0.5 text-[11px] text-fg-secondary hover:bg-accent/15 hover:text-accent border border-border/80"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-table-seats">Seating Capacity</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="edit-table-seats"
                  type="number"
                  min={1}
                  max={99}
                  value={editSeats}
                  onChange={(e) => setEditSeats(Number(e.target.value) || 2)}
                  className="w-24"
                  required
                />
                <div className="flex flex-wrap gap-1">
                  {SEAT_PRESETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditSeats(s)}
                      className={`rounded px-2.5 py-1 text-xs font-medium border ${
                        editSeats === s
                          ? "border-accent bg-accent/20 text-accent"
                          : "border-border bg-surface text-fg-secondary hover:border-accent/40"
                      }`}
                    >
                      {s} seats
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingTable(null)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={savingEdit || !editCode.trim()}>
                {savingEdit ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE TABLE CONFIRMATION DIALOG */}
      <Dialog
        open={Boolean(deletingTable)}
        onOpenChange={(open) => !open && setDeletingTable(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-danger">Delete Table</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete table{" "}
              <strong className="text-fg-primary">&ldquo;{deletingTable?.code}&rdquo;</strong>?
              This will remove the table from POS dine-in floor plans.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-end gap-2.5 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingTable(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleDeleteTable}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Confirm Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
