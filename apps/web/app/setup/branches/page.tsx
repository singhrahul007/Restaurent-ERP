"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit2,
  MapPin,
  Plus,
  Radio,
  Search,
  ShieldAlert,
  Trash2,
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
  Skeleton,
  toast,
} from "@niva/ui";
import { ApiError, api } from "../../../lib/api";

type Branch = {
  id: string;
  name: string;
  posIdleTimeoutMinutes: number;
};

export default function BranchesSetupPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("Could not load branches");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

  // Create Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createTimeout, setCreateTimeout] = useState(15);
  const [creating, setCreating] = useState(false);

  // Edit Modal state
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editName, setEditName] = useState("");
  const [editTimeout, setEditTimeout] = useState(15);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Modal state
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function restaurantId() {
    return window.localStorage.getItem("niva_restaurant_id");
  }

  async function load() {
    let id = restaurantId();
    if (!id) {
      try {
        const data = await api<{ restaurants: Array<{ id: string }> }>("/restaurants");
        if (data.restaurants[0]) {
          id = data.restaurants[0].id;
          window.localStorage.setItem("niva_restaurant_id", id);
        }
      } catch {
        // Handled below
      }
    }
    if (!id) {
      setStatus("error");
      setError("Please set up or select a restaurant first.");
      return;
    }

    const storedBranchId = window.localStorage.getItem("niva_branch_id");
    setActiveBranchId(storedBranchId);

    setStatus("loading");
    try {
      const data = await api<{ branches: Branch[] }>(`/restaurants/${id}/branches`);
      setBranches(data.branches);

      // If no active branch is stored or stored is not in list, auto-select first
      if (data.branches.length > 0) {
        if (!storedBranchId || !data.branches.some((b) => b.id === storedBranchId)) {
          const firstId = data.branches[0]?.id;
          if (firstId) {
            window.localStorage.setItem("niva_branch_id", firstId);
            setActiveBranchId(firstId);
          }
        }
      }

      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load branches");
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function handleSelectActiveBranch(branch: Branch) {
    window.localStorage.setItem("niva_branch_id", branch.id);
    setActiveBranchId(branch.id);
    toast.success(`Switched active workspace to "${branch.name}"`);
  }

  async function handleCreateBranch(event: FormEvent) {
    event.preventDefault();
    let id = restaurantId();
    if (!id) {
      try {
        const data = await api<{ restaurants: Array<{ id: string }> }>("/restaurants");
        if (data.restaurants[0]) {
          id = data.restaurants[0].id;
          window.localStorage.setItem("niva_restaurant_id", id);
        }
      } catch {
        // Ignore
      }
    }
    if (!id || !createName.trim()) {
      return;
    }

    setCreating(true);
    try {
      const newBranch = await api<Branch>(`/restaurants/${id}/branches`, {
        method: "POST",
        body: JSON.stringify({
          name: createName.trim(),
          posIdleTimeoutMinutes: Number(createTimeout) || 15,
        }),
      });

      // If this is the only branch, set as active
      if (!activeBranchId || branches.length === 0) {
        window.localStorage.setItem("niva_branch_id", newBranch.id);
        setActiveBranchId(newBranch.id);
      }

      setCreateName("");
      setCreateTimeout(15);
      setCreateOpen(false);
      toast.success(`Branch "${newBranch.name}" created successfully`);
      await load();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not create branch");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(branch: Branch) {
    setEditingBranch(branch);
    setEditName(branch.name);
    setEditTimeout(branch.posIdleTimeoutMinutes || 15);
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingBranch || !editName.trim()) return;

    setSavingEdit(true);
    try {
      await api(`/branches/${editingBranch.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          posIdleTimeoutMinutes: Number(editTimeout) || 15,
        }),
      });
      toast.success("Branch details updated");
      setEditingBranch(null);
      await load();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not update branch");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteBranch() {
    if (!deletingBranch) return;

    if (branches.length <= 1) {
      toast.error("You must maintain at least one branch for this restaurant.");
      setDeletingBranch(null);
      return;
    }

    setDeleting(true);
    try {
      await api(`/branches/${deletingBranch.id}`, {
        method: "DELETE",
      });

      // If we deleted the active branch, fallback to another
      if (activeBranchId === deletingBranch.id) {
        const remaining = branches.filter((b) => b.id !== deletingBranch.id);
        if (remaining[0]) {
          window.localStorage.setItem("niva_branch_id", remaining[0].id);
          setActiveBranchId(remaining[0].id);
        }
      }

      toast.success(`Branch "${deletingBranch.name}" removed`);
      setDeletingBranch(null);
      await load();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not delete branch");
    } finally {
      setDeleting(false);
    }
  }

  function copyBranchId(id: string) {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("Branch ID copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase().trim()),
  );

  const activeBranch = branches.find((b) => b.id === activeBranchId);

  if (status === "loading") {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (status === "error") {
    return <ErrorState description={error} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches & Locations"
        description="Configure physical restaurant outlets, POS idle lock timeout policies, and switch your active branch workspace."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Add Branch
          </Button>
        }
      />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Building2 className="size-5" />
            </div>
            <div>
              <p className="text-xs text-fg-muted font-medium">Total Outlets</p>
              <p className="text-xl font-bold text-fg-primary">{branches.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-fg-muted font-medium">Active Workspace</p>
              <p className="truncate text-base font-semibold text-fg-primary">
                {activeBranch?.name ?? "None Selected"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xs text-fg-muted font-medium">POS Security Lock</p>
              <p className="text-base font-semibold text-fg-primary">
                {activeBranch ? `${activeBranch.posIdleTimeoutMinutes} min timeout` : "15 min default"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search branches by name…"
            className="pl-9"
          />
        </div>
        <div className="text-xs text-fg-muted">
          Showing {filteredBranches.length} of {branches.length} {branches.length === 1 ? "branch" : "branches"}
        </div>
      </div>

      {/* Branches Grid */}
      {filteredBranches.length === 0 ? (
        <EmptyState
          title={searchQuery ? "No matching branches" : "No branches configured"}
          description={
            searchQuery
              ? `No branch found matching "${searchQuery}". Try a different keyword.`
              : "Add your restaurant's first branch location to manage dining tables, POS, and inventory."
          }
          action={
            searchQuery ? (
              <Button variant="secondary" size="sm" onClick={() => setSearchQuery("")}>
                Clear Search
              </Button>
            ) : (
              <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="size-4" /> Add Branch
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredBranches.map((branch) => {
            const isActive = branch.id === activeBranchId;
            return (
              <Card
                key={branch.id}
                className={`flex flex-col justify-between transition-all ${
                  isActive
                    ? "border-accent/40 bg-surface/90 shadow-[var(--shadow-glow)] ring-1 ring-accent/30"
                    : "hover:border-border-strong hover:bg-surface/80"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-md ${
                          isActive
                            ? "bg-accent text-white shadow-sm"
                            : "bg-elevated border border-border text-fg-secondary"
                        }`}
                      >
                        <Building2 className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-fg-primary text-base">
                          {branch.name}
                        </h3>
                        <p className="flex items-center gap-1 text-[11px] text-fg-muted font-mono">
                          <span>{branch.id.slice(0, 8)}…{branch.id.slice(-4)}</span>
                          <button
                            type="button"
                            onClick={() => copyBranchId(branch.id)}
                            className="text-fg-muted hover:text-fg-primary p-0.5"
                            title="Copy ID"
                          >
                            {copiedId === branch.id ? (
                              <Check className="size-3 text-emerald-400" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </p>
                      </div>
                    </div>

                    {isActive ? (
                      <Badge variant="success" dot className="shrink-0">
                        Active
                      </Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectActiveBranch(branch)}
                        className="rounded px-2 py-1 text-xs font-medium text-fg-muted transition hover:bg-elevated hover:text-fg-primary"
                      >
                        Set Active
                      </button>
                    )}
                  </div>

                  <div className="my-4 space-y-2 rounded-lg border border-border/60 bg-subtle/40 p-3 text-xs">
                    <div className="flex items-center justify-between text-fg-secondary">
                      <span className="flex items-center gap-1.5 text-fg-muted">
                        <Clock className="size-3.5" />
                        POS Idle Timeout:
                      </span>
                      <span className="font-semibold text-fg-primary">
                        {branch.posIdleTimeoutMinutes} mins
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-fg-secondary">
                      <span className="flex items-center gap-1.5 text-fg-muted">
                        <MapPin className="size-3.5" />
                        Role:
                      </span>
                      <span className="text-fg-muted">
                        {isActive ? "Primary Workspace" : "Secondary Location"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-3">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(branch)}
                      className="h-8 gap-1.5 px-2.5 text-xs text-fg-secondary hover:text-fg-primary"
                    >
                      <Edit2 className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeletingBranch(branch)}
                      className="h-8 gap-1.5 px-2.5 text-xs text-danger/80 hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </div>

                  {!isActive && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSelectActiveBranch(branch)}
                      className="h-8 text-xs"
                    >
                      Switch
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE BRANCH DIALOG */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Branch</DialogTitle>
            <DialogDescription>
              Create a new physical restaurant outlet or franchise location.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateBranch} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="branch-create-name">Branch Name</Label>
              <Input
                id="branch-create-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Bandra Flagship, Airport Express"
                required
                autoFocus
              />
              <p className="text-xs text-fg-muted">
                Display name printed on customer order receipts and table labels.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branch-create-timeout">POS Idle Lock Timeout (minutes)</Label>
              <Input
                id="branch-create-timeout"
                type="number"
                min={1}
                max={1440}
                value={createTimeout}
                onChange={(e) => setCreateTimeout(Number(e.target.value) || 15)}
                required
              />
              <p className="text-xs text-fg-muted">
                Automatically locks POS terminal screen after inactivity for cashier security.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" size="sm" disabled={creating || !createName.trim()}>
                {creating ? "Creating…" : "Create Branch"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT BRANCH DIALOG */}
      <Dialog
        open={Boolean(editingBranch)}
        onOpenChange={(open) => !open && setEditingBranch(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>
              Update location details and security parameters for this branch.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="branch-edit-name">Branch Name</Label>
              <Input
                id="branch-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branch-edit-timeout">POS Idle Lock Timeout (minutes)</Label>
              <Input
                id="branch-edit-timeout"
                type="number"
                min={1}
                max={1440}
                value={editTimeout}
                onChange={(e) => setEditTimeout(Number(e.target.value) || 15)}
                required
              />
              <p className="text-xs text-fg-muted">
                Screen will automatically lock after this duration of inactivity.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingBranch(null)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={savingEdit || !editName.trim()}>
                {savingEdit ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE BRANCH CONFIRMATION DIALOG */}
      <Dialog
        open={Boolean(deletingBranch)}
        onOpenChange={(open) => !open && setDeletingBranch(null)}
      >
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2 text-danger">
              <ShieldAlert className="size-5" />
              <DialogTitle className="text-danger">Delete Branch</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong className="text-fg-primary">
                &ldquo;{deletingBranch?.name}&rdquo;
              </strong>
              ? This action cannot be undone. Any tables or orders associated with this outlet will be affected.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-end gap-2.5 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingBranch(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleDeleteBranch}
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
