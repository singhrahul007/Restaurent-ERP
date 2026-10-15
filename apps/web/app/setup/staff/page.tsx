"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Bike,
  Building2,
  Check,
  ChefHat,
  Copy,
  CreditCard,
  Crown,
  Edit2,
  Headphones,
  Mail,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  UserPlus,
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

type StaffRow = {
  id: string;
  email: string;
  isOwner: boolean;
  roles: string[];
  branchIds: string[];
};

type Branch = { id: string; name: string };

const ROLES_INFO: Record<
  string,
  { label: string; desc: string; icon: typeof Users; color: string; bg: string }
> = {
  RESTAURANT_MANAGER: {
    label: "Restaurant Manager",
    desc: "Full operational access to inventory, menus, reports, and staff management.",
    icon: ShieldCheck,
    color: "text-purple-400",
    bg: "bg-purple-500/15 border-purple-500/25",
  },
  CASHIER: {
    label: "POS Cashier",
    desc: "Create orders, process payments, view dining tables, and apply discounts.",
    icon: CreditCard,
    color: "text-emerald-400",
    bg: "bg-emerald-500/15 border-emerald-500/25",
  },
  COOK: {
    label: "Kitchen Chef",
    desc: "Access Kitchen Display System (KDS), manage order tickets and item readiness.",
    icon: ChefHat,
    color: "text-amber-400",
    bg: "bg-amber-500/15 border-amber-500/25",
  },
  DELIVERY_AGENT: {
    label: "Delivery Agent",
    desc: "View assigned delivery jobs, update transit statuses, and confirm delivery OTPs.",
    icon: Bike,
    color: "text-sky-400",
    bg: "bg-sky-500/15 border-sky-500/25",
  },
  RECEPTIONIST: {
    label: "Receptionist / Host",
    desc: "Manage guest dining reservations and seat guests at available tables.",
    icon: Headphones,
    color: "text-pink-400",
    bg: "bg-pink-500/15 border-pink-500/25",
  },
};

const ROLES_LIST = Object.keys(ROLES_INFO);

export default function StaffSetupPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "forbidden" | "error">(
    "loading",
  );
  const [error, setError] = useState("Could not load staff");
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("ALL");

  // Invite Modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [roleSlug, setRoleSlug] = useState<string>("CASHIER");
  const [branchId, setBranchId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [lastInviteToken, setLastInviteToken] = useState<string | null>(null);

  // Edit Modal state
  const [editingStaff, setEditingStaff] = useState<StaffRow | null>(null);
  const [editRoleSlug, setEditRoleSlug] = useState<string>("CASHIER");
  const [editBranchId, setEditBranchId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Copy feedback
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  async function load() {
    setStatus("loading");
    try {
      let restaurantId = window.localStorage.getItem("niva_restaurant_id");
      if (!restaurantId) {
        try {
          const resData = await api<{ restaurants: Array<{ id: string }> }>("/restaurants");
          if (resData.restaurants[0]) {
            restaurantId = resData.restaurants[0].id;
            window.localStorage.setItem("niva_restaurant_id", restaurantId);
          }
        } catch {
          // Ignore
        }
      }

      const [staffData, branchData] = await Promise.all([
        api<{ staff: StaffRow[] }>("/staff"),
        restaurantId
          ? api<{ branches: Branch[] }>(`/restaurants/${restaurantId}/branches`)
          : Promise.resolve({ branches: [] as Branch[] }),
      ]);
      setStaff(staffData.staff);
      setBranches(branchData.branches);
      setBranchId(branchData.branches[0]?.id ?? "");
      setStatus("ready");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 403) {
        setStatus("forbidden");
        return;
      }
      setError(caught instanceof ApiError ? caught.message : "Could not load staff");
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;

    setInviting(true);
    setLastInviteToken(null);
    try {
      const res = await api<{ id: string; email: string; inviteToken?: string }>(
        "/staff/invites",
        {
          method: "POST",
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            roleSlug,
            branchIds: branchId ? [branchId] : [],
          }),
        },
      );
      toast.success(`Invite dispatched to ${email}`);
      if (res.inviteToken) {
        setLastInviteToken(res.inviteToken);
      } else {
        setInviteOpen(false);
      }
      setEmail("");
      await load();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not send invite");
    } finally {
      setInviting(false);
    }
  }

  function openEdit(member: StaffRow) {
    setEditingStaff(member);
    setEditRoleSlug(member.roles[0] || "CASHIER");
    setEditBranchId(member.branchIds[0] || "");
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingStaff) return;

    setSavingEdit(true);
    try {
      await api(`/staff/${editingStaff.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          roleSlug: editRoleSlug,
          branchIds: editBranchId ? [editBranchId] : [],
        }),
      });
      toast.success("Team member access updated");
      setEditingStaff(null);
      await load();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not update staff member");
    } finally {
      setSavingEdit(false);
    }
  }

  function copyText(val: string, type: "email" | "token") {
    navigator.clipboard.writeText(val);
    if (type === "email") {
      setCopiedEmail(val);
      toast.success("Email copied to clipboard");
      setTimeout(() => setCopiedEmail(null), 2000);
    } else {
      toast.success("Invite token copied");
    }
  }

  const filteredStaff = staff.filter((member) => {
    const matchesSearch = member.email.toLowerCase().includes(searchQuery.toLowerCase().trim());
    const matchesRole =
      selectedRoleFilter === "ALL"
        ? true
        : selectedRoleFilter === "OWNER"
          ? member.isOwner
          : member.roles.includes(selectedRoleFilter);
    return matchesSearch && matchesRole;
  });

  const getBranchNames = (branchIds: string[]) => {
    if (!branchIds || branchIds.length === 0) return "All Branches";
    const names = branchIds
      .map((id) => branches.find((b) => b.id === id)?.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : "All Branches";
  };

  const managersCount = staff.filter((s) => s.roles.includes("RESTAURANT_MANAGER") || s.isOwner).length;
  const cashiersCount = staff.filter((s) => s.roles.includes("CASHIER")).length;
  const cooksCount = staff.filter((s) => s.roles.includes("COOK")).length;

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

  if (status === "forbidden") {
    return (
      <ErrorState
        title="Owner or Manager Access Required"
        description="You do not have staff.manage permissions to manage team accounts."
      />
    );
  }

  if (status === "error") {
    return <ErrorState description={error} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & Team Roles"
        description="Invite employees, configure role-based access clearances, and assign branch locations."
        actions={
          <Button onClick={() => { setLastInviteToken(null); setInviteOpen(true); }} className="gap-2">
            <UserPlus className="size-4" />
            Invite Teammate
          </Button>
        }
      />

      {/* Top Stat Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-xs text-fg-muted font-medium">Team Members</p>
              <p className="text-xl font-bold text-fg-primary">{staff.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-xs text-fg-muted font-medium">Management & Owners</p>
              <p className="text-xl font-bold text-fg-primary">{managersCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <CreditCard className="size-5" />
            </div>
            <div>
              <p className="text-xs text-fg-muted font-medium">POS & Kitchen Staff</p>
              <p className="text-xl font-bold text-fg-primary">
                {cashiersCount + cooksCount} <span className="text-xs font-normal text-fg-muted">active</span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Role Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedRoleFilter("ALL")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedRoleFilter === "ALL"
                ? "bg-accent text-white shadow-sm"
                : "bg-surface border border-border text-fg-secondary hover:text-fg-primary"
            }`}
          >
            All Members ({staff.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedRoleFilter("RESTAURANT_MANAGER")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedRoleFilter === "RESTAURANT_MANAGER"
                ? "bg-accent text-white shadow-sm"
                : "bg-surface border border-border text-fg-secondary hover:text-fg-primary"
            }`}
          >
            Managers
          </button>
          <button
            type="button"
            onClick={() => setSelectedRoleFilter("CASHIER")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedRoleFilter === "CASHIER"
                ? "bg-accent text-white shadow-sm"
                : "bg-surface border border-border text-fg-secondary hover:text-fg-primary"
            }`}
          >
            Cashiers
          </button>
          <button
            type="button"
            onClick={() => setSelectedRoleFilter("COOK")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedRoleFilter === "COOK"
                ? "bg-accent text-white shadow-sm"
                : "bg-surface border border-border text-fg-secondary hover:text-fg-primary"
            }`}
          >
            Kitchen (KDS)
          </button>
          <button
            type="button"
            onClick={() => setSelectedRoleFilter("DELIVERY_AGENT")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedRoleFilter === "DELIVERY_AGENT"
                ? "bg-accent text-white shadow-sm"
                : "bg-surface border border-border text-fg-secondary hover:text-fg-primary"
            }`}
          >
            Delivery
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search teammate by email…"
            className="h-8.5 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Staff Grid Cards */}
      {filteredStaff.length === 0 ? (
        <EmptyState
          title={searchQuery ? "No teammates found" : "No staff members"}
          description={
            searchQuery
              ? `No user matching "${searchQuery}". Check the spelling or clear filter.`
              : "Invite your managers, cashiers, cooks, and delivery staff to collaborate."
          }
          action={
            <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-2">
              <UserPlus className="size-4" /> Invite Teammate
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStaff.map((member) => {
            const primaryRoleSlug = member.roles[0] || (member.isOwner ? "RESTAURANT_MANAGER" : "CASHIER");
            const roleConfig = ROLES_INFO[primaryRoleSlug] || {
              label: primaryRoleSlug,
              desc: "Custom role",
              icon: Users,
              color: "text-fg-secondary",
              bg: "bg-surface border-border",
            };
            const RoleIcon = member.isOwner ? Crown : roleConfig.icon;
            const branchText = getBranchNames(member.branchIds);

            // Generate initial from email
            const initial = member.email.charAt(0).toUpperCase();

            return (
              <Card
                key={member.id}
                className="group relative flex flex-col justify-between overflow-hidden border-border/80 bg-surface/80 p-5 transition-all hover:border-accent/40 hover:shadow-[var(--shadow-md)]"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div
                        className={`flex size-10 shrink-0 items-center justify-center rounded-full font-bold text-sm ${
                          member.isOwner
                            ? "bg-gradient-to-tr from-amber-500 to-yellow-400 text-white shadow-sm"
                            : "bg-gradient-to-tr from-elevated to-surface text-accent border border-border"
                        }`}
                      >
                        {initial}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-semibold text-fg-primary text-sm">
                          {member.email}
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-fg-muted">
                          <Building2 className="size-3" />
                          <span className="truncate">{branchText}</span>
                        </p>
                      </div>
                    </div>

                    {member.isOwner ? (
                      <Badge variant="warning" className="shrink-0 gap-1 font-semibold">
                        <Crown className="size-3" /> Owner
                      </Badge>
                    ) : (
                      <Badge variant="primary" className="shrink-0">
                        Active
                      </Badge>
                    )}
                  </div>

                  {/* Role Pill Card */}
                  <div className={`flex items-center gap-2 rounded-lg border p-2.5 my-3 text-xs ${roleConfig.bg}`}>
                    <RoleIcon className={`size-4 shrink-0 ${member.isOwner ? "text-amber-400" : roleConfig.color}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-fg-primary truncate">
                        {member.isOwner ? "Owner (Full Admin)" : roleConfig.label}
                      </p>
                      <p className="text-[11px] text-fg-muted line-clamp-1">{roleConfig.desc}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-3 mt-2">
                  <button
                    type="button"
                    onClick={() => copyText(member.email, "email")}
                    className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg-primary transition"
                  >
                    {copiedEmail === member.email ? (
                      <Check className="size-3 text-emerald-400" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    <span>Copy email</span>
                  </button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEdit(member)}
                    className="h-8 gap-1.5 text-xs text-fg-secondary hover:text-accent"
                  >
                    <Edit2 className="size-3.5" />
                    Edit Access
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* INVITE STAFF DIALOG */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invite to grant access to your restaurant workspace.
            </DialogDescription>
          </DialogHeader>

          {lastInviteToken ? (
            /* Invite Token dev display */
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-sm font-semibold text-emerald-400">Invite Created Successfully!</p>
                <p className="mt-1 text-xs text-fg-secondary">
                  In local development, you can use the token below to register or accept:
                </p>
                <div className="mt-3 flex items-center justify-between rounded bg-surface p-2 text-xs font-mono">
                  <span className="truncate pr-2">{lastInviteToken}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs"
                    onClick={() => copyText(lastInviteToken, "token")}
                  >
                    Copy Token
                  </Button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => {
                    setLastInviteToken(null);
                    setInviteOpen(false);
                  }}
                  size="sm"
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="staff-email">Email Address</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@restaurant.com"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-role">Role & Clearances</Label>
                <Select
                  id="staff-role"
                  value={roleSlug}
                  onChange={(e) => setRoleSlug(e.target.value)}
                >
                  {ROLES_LIST.map((r) => (
                    <option key={r} value={r}>
                      {ROLES_INFO[r]?.label ?? r}
                    </option>
                  ))}
                </Select>
                {ROLES_INFO[roleSlug] && (
                  <p className="text-xs text-fg-muted bg-subtle/50 p-2 rounded border border-border/60">
                    {ROLES_INFO[roleSlug].desc}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-branch">Branch Assignment</Label>
                <Select
                  id="staff-branch"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                >
                  <option value="">All Branches (Unrestricted)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-fg-muted">
                  Restrict the member&apos;s shift actions to a specific physical location.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline" size="sm">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" size="sm" disabled={inviting || !email.trim()}>
                  {inviting ? "Sending…" : "Send Invite"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* EDIT STAFF ACCESS DIALOG */}
      <Dialog
        open={Boolean(editingStaff)}
        onOpenChange={(open) => !open && setEditingStaff(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Staff Access</DialogTitle>
            <DialogDescription>
              Update role assignment and outlet clearances for{" "}
              <strong className="text-fg-primary">{editingStaff?.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-staff-role">Role</Label>
              <Select
                id="edit-staff-role"
                value={editRoleSlug}
                onChange={(e) => setEditRoleSlug(e.target.value)}
              >
                {ROLES_LIST.map((r) => (
                  <option key={r} value={r}>
                    {ROLES_INFO[r]?.label ?? r}
                  </option>
                ))}
              </Select>
              {ROLES_INFO[editRoleSlug] && (
                <p className="text-xs text-fg-muted bg-subtle/50 p-2 rounded border border-border/60">
                  {ROLES_INFO[editRoleSlug].desc}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-staff-branch">Branch Assignment</Label>
              <Select
                id="edit-staff-branch"
                value={editBranchId}
                onChange={(e) => setEditBranchId(e.target.value)}
              >
                <option value="">All Branches (Unrestricted)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingStaff(null)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={savingEdit}>
                {savingEdit ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
