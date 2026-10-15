"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  toast,
} from "@niva/ui";
import {
  ShieldAlert,
  ShieldCheck,
  Building2,
  Store,
  Users,
  CheckCircle2,
  XCircle,
  Sparkles,
  SlidersHorizontal,
  Save,
  RotateCcw,
  Search,
  ChevronRight,
  Info,
  Lock,
  Unlock,
  KeyRound,
  Eye,
} from "lucide-react";
import { api } from "../../../lib/api";

type RoleItem = {
  id: string;
  slug: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
};

type DirectoryMember = {
  userId: string;
  email: string;
  membershipId: string;
  organizationId: string;
  isOwner: boolean;
  roleId: string | null;
  roleSlug: string | null;
  roleName: string | null;
  assignedBranchIds: string[];
};

type RestaurantItem = {
  id: string;
  name: string;
  organizationId: string;
};

type BranchItem = {
  id: string;
  name: string;
  restaurantId: string;
  organizationId: string;
};

// Groups and human readable permission metadata
const PERMISSION_GROUPS: Record<
  string,
  { label: string; icon: string; items: { code: string; title: string; desc: string }[] }
> = {
  platform: {
    label: "Platform & Governance",
    icon: "ShieldAlert",
    items: [
      { code: "platform.manage", title: "Full Platform Root Control", desc: "Access global tenants, billing & server settings" },
      { code: "roles.view", title: "View Access Matrix", desc: "Read-only access to role configurations and user scopes" },
      { code: "roles.manage", title: "Manage Access Matrix", desc: "Edit role permissions and toggle feature availability" },
    ],
  },
  restaurants: {
    label: "Restaurant & Franchise Scope",
    icon: "Building2",
    items: [
      { code: "restaurant.view", title: "View Restaurant Info", desc: "See restaurant profiles and locations" },
      { code: "restaurant.manage", title: "Manage Restaurant Config", desc: "Modify brand settings, operating hours and taxes" },
      { code: "branch.view", title: "View Assigned Branches", desc: "Read-only list of accessible branch details" },
      { code: "branch.manage", title: "Manage Branches", desc: "Configure branch tables, printers and registers" },
      { code: "branch.assign", title: "Branch Staff Assignment", desc: "Allocate managers and staff to specific branch stores" },
    ],
  },
  pos_orders: {
    label: "POS, Register & Orders",
    icon: "Store",
    items: [
      { code: "orders.view", title: "View Active & Past Orders", desc: "Browse orders feed, history and status tracker" },
      { code: "orders.create", title: "Punch / Create Orders", desc: "Take customer orders, dine-in & takeaway tickets" },
      { code: "orders.update", title: "Edit / Split Order Items", desc: "Add modifiers, change quantities, apply discount lines" },
      { code: "orders.cancel", title: "Void & Cancel Orders", desc: "Authorise ticket cancellation or item deletion" },
      { code: "tables.view", title: "Dine-In Floor Map View", desc: "See live table occupancy and order status" },
      { code: "tables.manage", title: "Floor & Table Management", desc: "Rearrange tables, merge dining sections" },
    ],
  },
  financials: {
    label: "Payments & Financial Operations",
    icon: "KeyRound",
    items: [
      { code: "payments.view", title: "View Settlement & Transactions", desc: "Review shift receipts and gateway settlements" },
      { code: "payments.create", title: "Accept & Collect Payments", desc: "Process cash, UPI, cards, and generate invoice" },
      { code: "payments.refund", title: "Issue Refunds & Chargebacks", desc: "Authorize monetary refunds and voided charges" },
      { code: "reports.view", title: "Sales & P&L Analytics", desc: "Access revenue metrics, gross profit and shift reports" },
    ],
  },
  catalog_kitchen: {
    label: "Menu, Kitchen & Operations",
    icon: "SlidersHorizontal",
    items: [
      { code: "menu.view", title: "Browse Menu Catalog", desc: "View food dishes, recipe costings, and categories" },
      { code: "menu.manage", title: "Edit Menu & Price Adjustments", desc: "Change item prices, activate 86ing, add new dishes" },
      { code: "kitchen.view", title: "Kitchen Display Screen (KDS)", desc: "View incoming kitchen order tickets" },
      { code: "kitchen.update", title: "Bump & Complete Prep Items", desc: "Mark dishes as cooking, prepared, or ready to serve" },
      { code: "inventory.view", title: "Stock & Inventory Inspection", desc: "View raw ingredient stock levels and thresholds" },
      { code: "inventory.manage", title: "Inventory Purchases & Audits", desc: "Receive PO deliveries, log waste and stock adjustments" },
      { code: "delivery.view", title: "Delivery & Rider Queue", desc: "Monitor in-transit orders and delivery drivers" },
      { code: "delivery.manage", title: "Dispatch & Driver Assignment", desc: "Assign orders to fleet drivers or external riders" },
      { code: "delivery.self", title: "Driver Self Execution", desc: "Used by drivers to accept deliveries and enter OTP" },
    ],
  },
  administration: {
    label: "Staff & Settings Control",
    icon: "Users",
    items: [
      { code: "staff.view", title: "View Team Directory", desc: "Browse employees, assigned branches and shifts" },
      { code: "staff.manage", title: "Invite & Manage Staff", desc: "Add or terminate team members and adjust job roles" },
      { code: "customers.view", title: "Customer CRM Directory", desc: "View customer profiles, contact numbers & order logs" },
      { code: "customers.manage", title: "Customer Notes & Loyalty", desc: "Edit loyalty points and customer communication preferences" },
      { code: "settings.view", title: "View System Configurations", desc: "View store preferences, tax configuration, printers" },
      { code: "settings.manage", title: "Modify Core Settings", desc: "Change billing credentials, invoice template & integrations" },
    ],
  },
};

export default function AccessControlStudioPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"roles" | "assignments" | "preview">("roles");

  // Data states
  const [rolesList, setRolesList] = useState<RoleItem[]>([]);
  const [selectedRoleSlug, setSelectedRoleSlug] = useState<string>("SUPER_ADMIN");
  const [editedPermissions, setEditedPermissions] = useState<Record<string, string[]>>({});
  
  // Directory & Assignments
  const [restaurants, setRestaurants] = useState<RestaurantItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedMember, setSelectedMember] = useState<DirectoryMember | null>(null);
  const [memberAssignedBranches, setMemberAssignedBranches] = useState<string[]>([]);
  const [savingAssignments, setSavingAssignments] = useState(false);

  // Load directory and roles
  const loadData = async () => {
    try {
      setLoading(true);
      const [rolesRes, dirRes] = await Promise.all([
        api<{ roles: RoleItem[]; allPermissionCodes: string[] }>("/platform/roles"),
        api<{ restaurants: RestaurantItem[]; branches: BranchItem[]; members: DirectoryMember[] }>(
          "/platform/access-control/directory"
        ),
      ]);

      setRolesList(rolesRes.roles);
      // Initialize edited permissions mapping
      const mapping: Record<string, string[]> = {};
      for (const r of rolesRes.roles) {
        mapping[r.slug] = [...r.permissions];
      }
      setEditedPermissions(mapping);

      setRestaurants(dirRes.restaurants);
      setBranches(dirRes.branches);
      setMembers(dirRes.members);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load access control directory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeRole = useMemo(() => {
    return rolesList.find((r) => r.slug === selectedRoleSlug) ?? rolesList[0];
  }, [rolesList, selectedRoleSlug]);

  const currentPermissions = useMemo(() => {
    if (!activeRole) return [];
    return editedPermissions[activeRole.slug] ?? activeRole.permissions;
  }, [activeRole, editedPermissions]);

  const hasUnsavedChanges = useMemo(() => {
    if (!activeRole) return false;
    const original = activeRole.permissions.slice().sort().join(",");
    const current = (editedPermissions[activeRole.slug] ?? []).slice().sort().join(",");
    return original !== current;
  }, [activeRole, editedPermissions]);

  const togglePermission = (code: string) => {
    if (!activeRole) return;
    const existing = editedPermissions[activeRole.slug] ?? activeRole.permissions;
    const exists = existing.includes(code);
    const updated = exists ? existing.filter((c) => c !== code) : [...existing, code];
    setEditedPermissions((prev) => ({
      ...prev,
      [activeRole.slug]: updated,
    }));
  };

  const handleSelectAllInGroup = (codes: string[], select: boolean) => {
    if (!activeRole) return;
    const existing = new Set(editedPermissions[activeRole.slug] ?? activeRole.permissions);
    codes.forEach((c) => {
      if (select) existing.add(c);
      else existing.delete(c);
    });
    setEditedPermissions((prev) => ({
      ...prev,
      [activeRole.slug]: Array.from(existing),
    }));
  };

  const handleReset = () => {
    if (!activeRole) return;
    setEditedPermissions((prev) => ({
      ...prev,
      [activeRole.slug]: [...activeRole.permissions],
    }));
    toast.info("Reverted permission adjustments to last saved state");
  };

  const handleSaveRole = async () => {
    if (!activeRole) return;
    try {
      setSaving(true);
      await api(`/platform/roles/${activeRole.id}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions: currentPermissions }),
      });
      toast.success(`Updated permissions for ${activeRole.name}`);
      // Update local baseline
      setRolesList((prev) =>
        prev.map((r) => (r.id === activeRole.id ? { ...r, permissions: currentPermissions } : r))
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAssignDrawer = (member: DirectoryMember) => {
    setSelectedMember(member);
    setMemberAssignedBranches([...member.assignedBranchIds]);
  };

  const handleToggleBranchAssignment = (branchId: string) => {
    setMemberAssignedBranches((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    );
  };

  const handleSaveBranchAssignments = async () => {
    if (!selectedMember) return;
    try {
      setSavingAssignments(true);
      await api("/platform/access-control/assign-branches", {
        method: "POST",
        body: JSON.stringify({
          membershipId: selectedMember.membershipId,
          organizationId: selectedMember.organizationId,
          branchIds: memberAssignedBranches,
        }),
      });
      toast.success(`Assigned ${memberAssignedBranches.length} branch(es) to ${selectedMember.email}`);
      // Update local member state
      setMembers((prev) =>
        prev.map((m) =>
          m.membershipId === selectedMember.membershipId
            ? { ...m, assignedBranchIds: memberAssignedBranches }
            : m
        )
      );
      setSelectedMember(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save branch assignments");
    } finally {
      setSavingAssignments(false);
    }
  };

  // Filtered members list
  const filteredMembers = useMemo(() => {
    if (!searchFilter.trim()) return members;
    const q = searchFilter.toLowerCase();
    return members.filter(
      (m) =>
        m.email.toLowerCase().includes(q) ||
        (m.roleName && m.roleName.toLowerCase().includes(q)) ||
        (m.roleSlug && m.roleSlug.toLowerCase().includes(q))
    );
  }, [members, searchFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <div className="size-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <p className="text-sm font-medium text-fg-muted">Loading Access Control Matrix & Hierarchy...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-fg-primary">
                  Access & Permission Studio
                </h1>
                <Badge variant="purple" size="sm">Admin Only</Badge>
                <Badge variant="glass" size="sm">3-Tier Hierarchy</Badge>
              </div>
              <p className="text-xs text-fg-muted mt-0.5">
                Configure role capabilities, toggle operational features, and scope branch assignments
              </p>
            </div>
          </div>
        </div>

        {/* Global Stats Counter */}
        <div className="flex items-center gap-3 bg-elevated px-4 py-2 rounded-xl border border-border text-xs">
          <div>
            <span className="text-fg-muted">Roles: </span>
            <span className="font-semibold text-fg-primary">{rolesList.length}</span>
          </div>
          <span className="text-border">|</span>
          <div>
            <span className="text-fg-muted">Restaurants: </span>
            <span className="font-semibold text-fg-primary">{restaurants.length}</span>
          </div>
          <span className="text-border">|</span>
          <div>
            <span className="text-fg-muted">Branches: </span>
            <span className="font-semibold text-fg-primary">{branches.length}</span>
          </div>
          <span className="text-border">|</span>
          <div>
            <span className="text-fg-muted">Members: </span>
            <span className="font-semibold text-fg-primary">{members.length}</span>
          </div>
        </div>
      </div>

      {/* Primary Studio Tabs */}
      <Tabs defaultValue="roles" className="space-y-6" onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="bg-surface border border-border p-1 rounded-xl">
          <TabsTrigger value="roles" className="gap-2 text-xs font-semibold">
            <SlidersHorizontal className="size-3.5" />
            Roles & Feature Matrix
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2 text-xs font-semibold">
            <Building2 className="size-3.5" />
            Branch & Staff Scoping
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2 text-xs font-semibold">
            <Eye className="size-3.5" />
            Who Can Do What Audit
          </TabsTrigger>
        </TabsList>

        {/* ======================= TAB 1: ROLES & PERMISSION MATRIX ======================= */}
        <TabsContent value="roles" className="space-y-6 mt-0">
          {/* 3 Main Tier Cards Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tier 1: Admin */}
            <div
              onClick={() => setSelectedRoleSlug("SUPER_ADMIN")}
              className={`cursor-pointer rounded-2xl p-4 border transition-all ${
                selectedRoleSlug === "SUPER_ADMIN"
                  ? "border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20 shadow-md"
                  : "border-border bg-surface hover:border-border-hover"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">👑</span>
                  <span className="font-bold text-sm text-fg-primary">Admin (Root)</span>
                </div>
                <Badge variant="warning" size="sm">Global Scope</Badge>
              </div>
              <p className="text-xs text-fg-muted mb-3 leading-relaxed">
                Full unrestricted control. Manages all restaurants, franchise owners, billing, and access controls.
              </p>
              <div className="flex items-center justify-between text-[11px] text-fg-secondary">
                <span>Type: System Master</span>
                <span className="font-semibold text-amber-500">Universal Access</span>
              </div>
            </div>

            {/* Tier 2: RestaurantAdmin */}
            <div
              onClick={() => setSelectedRoleSlug("RESTAURANT_ADMIN")}
              className={`cursor-pointer rounded-2xl p-4 border transition-all ${
                selectedRoleSlug === "RESTAURANT_ADMIN"
                  ? "border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/20 shadow-md"
                  : "border-border bg-surface hover:border-border-hover"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏢</span>
                  <span className="font-bold text-sm text-fg-primary">RestaurantAdmin</span>
                </div>
                <Badge variant="primary" size="sm">Assigned Stores</Badge>
              </div>
              <p className="text-xs text-fg-muted mb-3 leading-relaxed">
                Manages operations, staff, menus, and inventory strictly within assigned restaurants and branches.
              </p>
              <div className="flex items-center justify-between text-[11px] text-fg-secondary">
                <span>Multi-branch Manager</span>
                <span className="font-semibold text-blue-500">Scoped Authority</span>
              </div>
            </div>

            {/* Tier 3: Restaurant Single Role */}
            <div
              onClick={() => setSelectedRoleSlug("RESTAURANT_SINGLE")}
              className={`cursor-pointer rounded-2xl p-4 border transition-all ${
                selectedRoleSlug === "RESTAURANT_SINGLE"
                  ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/20 shadow-md"
                  : "border-border bg-surface hover:border-border-hover"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🍽️</span>
                  <span className="font-bold text-sm text-fg-primary">Restaurant (Self)</span>
                </div>
                <Badge variant="success" size="sm">Single Unit</Badge>
              </div>
              <p className="text-xs text-fg-muted mb-3 leading-relaxed">
                Single store operator. Controls daily POS registers, table floor maps, and kitchen orders for their location only.
              </p>
              <div className="flex items-center justify-between text-[11px] text-fg-secondary">
                <span>Single Location Mode</span>
                <span className="font-semibold text-emerald-500">Isolated Store</span>
              </div>
            </div>
          </div>

          {/* Secondary Role Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-fg-muted font-medium pr-1">Other Roles:</span>
            {rolesList
              .filter(
                (r) =>
                  !["SUPER_ADMIN", "RESTAURANT_ADMIN", "RESTAURANT_SINGLE"].includes(r.slug)
              )
              .map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleSlug(role.slug)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                    selectedRoleSlug === role.slug
                      ? "border-accent bg-accent/10 text-accent font-semibold"
                      : "border-border bg-surface text-fg-secondary hover:text-fg-primary"
                  }`}
                >
                  {role.name}
                </button>
              ))}
          </div>

          {/* Active Role Configuration Bar */}
          {activeRole && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-surface border border-border">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center font-bold">
                  {activeRole.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-fg-primary">{activeRole.name}</h2>
                    <span className="text-xs text-fg-muted font-mono bg-elevated px-1.5 py-0.5 rounded border border-border">
                      {activeRole.slug}
                    </span>
                  </div>
                  <p className="text-xs text-fg-muted">
                    {currentPermissions.length} granted features active for this role
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={!hasUnsavedChanges || saving}
                  className="text-xs gap-1.5"
                >
                  <RotateCcw className="size-3.5" />
                  Discard
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveRole}
                  disabled={!hasUnsavedChanges || saving}
                  className="text-xs gap-1.5 font-semibold"
                >
                  <Save className="size-3.5" />
                  {saving ? "Saving..." : hasUnsavedChanges ? "Save Permissions" : "Saved"}
                </Button>
              </div>
            </div>
          )}

          {/* Permissions Matrix by Group */}
          <div className="space-y-6">
            {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => {
              const groupCodes = group.items.map((i) => i.code);
              const grantedInGroup = groupCodes.filter((c) => currentPermissions.includes(c));
              const allSelected = grantedInGroup.length === groupCodes.length;
              const someSelected = grantedInGroup.length > 0 && !allSelected;

              return (
                <div
                  key={groupKey}
                  className="rounded-2xl border border-border bg-surface/50 overflow-hidden"
                >
                  {/* Group Header */}
                  <div className="flex items-center justify-between px-5 py-3.5 bg-surface border-b border-border">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-sm text-fg-primary">
                        {group.label}
                      </span>
                      <Badge variant="glass" size="sm">
                        {grantedInGroup.length}/{groupCodes.length} Active
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSelectAllInGroup(groupCodes, !allSelected)}
                        className="text-xs font-medium text-accent hover:underline px-2 py-1 rounded"
                      >
                        {allSelected ? "De-assign All" : "Assign All"}
                      </button>
                    </div>
                  </div>

                  {/* Feature Items Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
                    {group.items.map((item) => {
                      const isGranted = currentPermissions.includes(item.code);

                      return (
                        <div
                          key={item.code}
                          onClick={() => togglePermission(item.code)}
                          className={`flex items-start justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                            isGranted
                              ? "bg-accent/[0.04] border-accent/40 shadow-xs"
                              : "bg-elevated/40 border-border opacity-70 hover:opacity-100"
                          }`}
                        >
                          <div className="space-y-1 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-fg-primary">
                                {item.title}
                              </span>
                              <span className="text-[10px] text-fg-muted font-mono">
                                {item.code}
                              </span>
                            </div>
                            <p className="text-[11px] text-fg-muted leading-tight">
                              {item.desc}
                            </p>
                          </div>

                          {/* Toggle Switch Visual */}
                          <div
                            className={`mt-0.5 relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                              isGranted ? "bg-accent" : "bg-neutral-600"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                isGranted ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ======================= TAB 2: BRANCH & STAFF ASSIGNMENTS ======================= */}
        <TabsContent value="assignments" className="space-y-6 mt-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-fg-primary">Branch & Restaurant Scoping</h2>
              <p className="text-xs text-fg-muted">
                Assign multi-branch permissions to <span className="text-blue-500 font-semibold">RestaurantAdmin</span> or bind single store users.
              </p>
            </div>

            {/* Search filter */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 size-4 text-fg-muted" />
              <input
                type="text"
                placeholder="Search staff email or role..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Members Table */}
          <div className="rounded-2xl border border-border bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-elevated border-b border-border text-fg-muted font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Hierarchy Tier</th>
                    <th className="px-4 py-3">Assigned Branches</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredMembers.map((member) => {
                    const isSuper = member.roleSlug === "SUPER_ADMIN";
                    const isRestAdmin = member.roleSlug === "RESTAURANT_ADMIN";
                    const isSingle = member.roleSlug === "RESTAURANT_SINGLE";

                    return (
                      <tr key={member.membershipId} className="hover:bg-elevated/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-fg-primary">
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold text-xs">
                              {member.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold">{member.email}</div>
                              {member.isOwner && (
                                <span className="text-[10px] text-amber-500 font-medium">Tenant Owner</span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-semibold text-fg-primary">
                            {member.roleName || "Unassigned"}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          {isSuper ? (
                            <Badge variant="warning" size="sm">👑 Admin (Global)</Badge>
                          ) : isRestAdmin ? (
                            <Badge variant="primary" size="sm">🏢 RestaurantAdmin</Badge>
                          ) : isSingle ? (
                            <Badge variant="success" size="sm">🍽️ Restaurant (Self)</Badge>
                          ) : (
                            <Badge variant="glass" size="sm">Operational Staff</Badge>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {isSuper ? (
                            <span className="text-xs text-amber-500 font-medium">All Branches (Global Access)</span>
                          ) : member.assignedBranchIds.length === 0 ? (
                            <span className="text-xs text-fg-muted italic">None assigned (No branch scope)</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {member.assignedBranchIds.map((bId) => {
                                const branch = branches.find((b) => b.id === bId);
                                return (
                                  <span
                                    key={bId}
                                    className="px-2 py-0.5 rounded-md bg-elevated border border-border text-[11px] font-medium text-fg-primary"
                                  >
                                    {branch?.name || bId.slice(0, 8)}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isSuper}
                            onClick={() => handleOpenAssignDrawer(member)}
                            className="text-xs gap-1"
                          >
                            <SlidersHorizontal className="size-3" />
                            Manage Branches
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Drawer / Modal for Branch Assignment */}
          {selectedMember && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
              <div className="bg-surface border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div>
                    <h3 className="text-base font-bold text-fg-primary">
                      Assign Branches to Staff
                    </h3>
                    <p className="text-xs text-fg-muted mt-0.5">
                      {selectedMember.email} • {selectedMember.roleName}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedMember(null)}
                    className="p-1.5 rounded-lg hover:bg-elevated text-fg-muted"
                  >
                    <XCircle className="size-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-fg-muted">
                    Select the specific restaurants and branches this user is authorized to manage:
                  </p>

                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {branches.length === 0 ? (
                      <p className="text-xs text-fg-muted italic p-4 text-center">No branches found in database</p>
                    ) : (
                      branches.map((b) => {
                        const isAssigned = memberAssignedBranches.includes(b.id);
                        const parentRestaurant = restaurants.find((r) => r.id === b.restaurantId);

                        return (
                          <div
                            key={b.id}
                            onClick={() => handleToggleBranchAssignment(b.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                              isAssigned
                                ? "bg-accent/10 border-accent text-accent font-semibold"
                                : "bg-elevated border-border text-fg-primary hover:border-border-hover"
                            }`}
                          >
                            <div>
                              <div className="text-xs font-semibold">{b.name}</div>
                              <div className="text-[11px] text-fg-muted">
                                {parentRestaurant ? parentRestaurant.name : "Main Franchise"}
                              </div>
                            </div>
                            {isAssigned ? (
                              <CheckCircle2 className="size-4 text-accent" />
                            ) : (
                              <div className="size-4 rounded-full border border-neutral-600" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedMember(null)}
                    disabled={savingAssignments}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveBranchAssignments}
                    disabled={savingAssignments}
                    className="font-semibold"
                  >
                    {savingAssignments ? "Saving..." : "Apply Assignments"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ======================= TAB 3: WHO CAN DO WHAT AUDIT ======================= */}
        <TabsContent value="preview" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Admin Audit Card */}
            <div className="rounded-2xl border border-amber-500/30 bg-surface p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">👑</span>
                  <h3 className="font-bold text-sm text-fg-primary">Admin Role</h3>
                </div>
                <Badge variant="warning" size="sm">Super Admin</Badge>
              </div>

              <div className="space-y-2 text-xs">
                <div className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> Can Do
                </div>
                <ul className="space-y-1.5 text-fg-secondary">
                  <li>• Access and modify Access Control Studio</li>
                  <li>• Add, suspend, or delete any restaurant</li>
                  <li>• Reconfigure system roles and custom permissions</li>
                  <li>• View consolidated multi-tenant network analytics</li>
                  <li>• Manage franchise owners and payment gateways</li>
                </ul>

                <div className="pt-2 text-[11px] font-semibold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                  <XCircle className="size-3.5" /> Cannot Do
                </div>
                <p className="text-fg-muted italic">No system restrictions apply.</p>
              </div>
            </div>

            {/* RestaurantAdmin Audit Card */}
            <div className="rounded-2xl border border-blue-500/30 bg-surface p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏢</span>
                  <h3 className="font-bold text-sm text-fg-primary">RestaurantAdmin Role</h3>
                </div>
                <Badge variant="primary" size="sm">Branch Admin</Badge>
              </div>

              <div className="space-y-2 text-xs">
                <div className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> Can Do
                </div>
                <ul className="space-y-1.5 text-fg-secondary">
                  <li>• Manage staff and invite workers for assigned branches</li>
                  <li>• Update dishes, pricing, and 86 items in assigned stores</li>
                  <li>• Supervise inventory stock, POs, and transfers</li>
                  <li>• View P&L and shift reports for assigned locations</li>
                  <li>• Assign cashiers and waiters to branches</li>
                </ul>

                <div className="pt-2 text-[11px] font-semibold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                  <XCircle className="size-3.5" /> Cannot Do
                </div>
                <ul className="space-y-1.5 text-rose-400/90">
                  <li>• Cannot view or edit unassigned restaurants</li>
                  <li>• Cannot edit global platform roles or matrix</li>
                  <li>• Cannot alter platform subscription billing</li>
                </ul>
              </div>
            </div>

            {/* Restaurant Single Audit Card */}
            <div className="rounded-2xl border border-emerald-500/30 bg-surface p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🍽️</span>
                  <h3 className="font-bold text-sm text-fg-primary">Restaurant Role (Self)</h3>
                </div>
                <Badge variant="success" size="sm">Self Single Store</Badge>
              </div>

              <div className="space-y-2 text-xs">
                <div className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> Can Do
                </div>
                <ul className="space-y-1.5 text-fg-secondary">
                  <li>• Take orders and process payments on POS</li>
                  <li>• Manage dining table seating and queue waitlist</li>
                  <li>• View and clear kitchen orders on KDS</li>
                  <li>• Perform end-of-day register shift closure</li>
                </ul>

                <div className="pt-2 text-[11px] font-semibold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                  <XCircle className="size-3.5" /> Cannot Do
                </div>
                <ul className="space-y-1.5 text-rose-400/90">
                  <li>• Cannot switch or view other branches</li>
                  <li>• Cannot modify menu master prices</li>
                  <li>• Cannot issue unmoderated refunds</li>
                  <li>• Cannot change tax rates or store settings</li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

