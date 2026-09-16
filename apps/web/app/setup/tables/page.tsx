"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Card,
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

type Branch = { id: string; name: string };
type DiningTable = { id: string; code: string; floor: string | null; seats: number | null };

export default function TablesSetupPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("Could not load tables");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [code, setCode] = useState("");
  const [floor, setFloor] = useState("");

  async function loadBranches() {
    const restaurantId = window.localStorage.getItem("niva_restaurant_id");
    if (!restaurantId) {
      setStatus("error");
      setError("Select a restaurant first.");
      return;
    }
    try {
      const data = await api<{ branches: Branch[] }>(`/restaurants/${restaurantId}/branches`);
      setBranches(data.branches);
      const first = data.branches[0]?.id ?? "";
      setBranchId((current) => current || first);
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
    const data = await api<{ tables: DiningTable[] }>(`/branches/${id}/tables`);
    setTables(data.tables);
  }

  useEffect(() => {
    void loadBranches();
  }, []);

  useEffect(() => {
    if (branchId) {
      void loadTables(branchId).catch((caught) => {
        setError(caught instanceof ApiError ? caught.message : "Could not load tables");
        setStatus("error");
      });
    }
  }, [branchId]);

  async function addTable(event: FormEvent) {
    event.preventDefault();
    if (!branchId || !code.trim()) {
      return;
    }
    await api(`/branches/${branchId}/tables`, {
      method: "POST",
      body: JSON.stringify({ code, floor: floor || undefined }),
    });
    setCode("");
    setFloor("");
    await loadTables(branchId);
  }

  if (status === "loading") {
    return <Skeleton className="h-48" />;
  }
  if (status === "error") {
    return <ErrorState description={error} onRetry={() => void loadBranches()} />;
  }

  return (
    <>
      <PageHeader
        title="Dining tables"
        description="Floor list only. POS table sessions are a later phase."
      />
      <Card className="mb-6 flex flex-col gap-4">
        <div className="max-w-xs">
          <Label htmlFor="branch">Branch</Label>
          <Select
            id="branch"
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        </div>
        <form className="flex max-w-lg flex-wrap items-end gap-3" onSubmit={addTable}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              className="font-mono"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="floor">Floor</Label>
            <Input id="floor" value={floor} onChange={(event) => setFloor(event.target.value)} />
          </div>
          <Button type="submit">Add table</Button>
        </form>
      </Card>
      {tables.length === 0 ? (
        <EmptyState title="No tables" description="Add a table code for this floor." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Floor</TableHead>
              <TableHead>Seats</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tables.map((table) => (
              <TableRow key={table.id}>
                <TableCell className="font-mono">{table.code}</TableCell>
                <TableCell>{table.floor ?? "—"}</TableCell>
                <TableCell>{table.seats ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
