"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const ROLES = [
  "RESTAURANT_MANAGER",
  "RECEPTIONIST",
  "CASHIER",
  "COOK",
  "DELIVERY_AGENT",
] as const;

export default function StaffSetupPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "forbidden" | "error">(
    "loading",
  );
  const [error, setError] = useState("Could not load staff");
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [email, setEmail] = useState("");
  const [roleSlug, setRoleSlug] = useState<(typeof ROLES)[number]>("CASHIER");
  const [branchId, setBranchId] = useState("");
  const [open, setOpen] = useState(false);

  async function load() {
    setStatus("loading");
    try {
      const restaurantId = window.localStorage.getItem("niva_restaurant_id");
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

  async function invite(event: FormEvent) {
    event.preventDefault();
    await api("/staff/invites", {
      method: "POST",
      body: JSON.stringify({
        email,
        roleSlug,
        branchIds: branchId ? [branchId] : [],
      }),
    });
    setEmail("");
    setOpen(false);
    await load();
  }

  if (status === "loading") {
    return <Skeleton className="h-48" />;
  }
  if (status === "forbidden") {
    return (
      <ErrorState
        title="Owner or manager only"
        description="You need staff.manage to invite people."
      />
    );
  }
  if (status === "error") {
    return <ErrorState description={error} onRetry={() => void load()} />;
  }

  return (
    <>
      <PageHeader
        title="Staff"
        description="Invite by email and assign a role."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Invite</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite staff</DialogTitle>
                <DialogDescription>They join this organization. Platform roles are not available.</DialogDescription>
              </DialogHeader>
              <form className="flex flex-col gap-3" onSubmit={invite}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select
                    id="invite-role"
                    value={roleSlug}
                    onChange={(event) =>
                      setRoleSlug(event.target.value as (typeof ROLES)[number])
                    }
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="invite-branch">Branch</Label>
                  <Select
                    id="invite-branch"
                    value={branchId}
                    onChange={(event) => setBranchId(event.target.value)}
                  >
                    <option value="">All branches</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit">Send invite</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      {staff.length === 0 ? (
        <EmptyState
          title="No teammates yet"
          description="Use Invite (top right). They receive a membership in this organization."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Branches</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.email}</TableCell>
                <TableCell>{row.roles.join(", ") || (row.isOwner ? "OWNER" : "—")}</TableCell>
                <TableCell>{row.branchIds.length || "All"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
