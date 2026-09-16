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
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@niva/ui";
import { ApiError, api } from "../../../lib/api";

type Branch = { id: string; name: string; posIdleTimeoutMinutes: number };

export default function BranchesSetupPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("Could not load branches");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function restaurantId() {
    return window.localStorage.getItem("niva_restaurant_id");
  }

  async function load() {
    const id = restaurantId();
    if (!id) {
      setStatus("error");
      setError("Select a restaurant first.");
      return;
    }
    setStatus("loading");
    try {
      const data = await api<{ branches: Branch[] }>(`/restaurants/${id}/branches`);
      setBranches(data.branches);
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load branches");
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createBranch(event: FormEvent) {
    event.preventDefault();
    const id = restaurantId();
    if (!id || !name.trim()) {
      return;
    }
    await api(`/restaurants/${id}/branches`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setName("");
    await load();
  }

  async function saveEdit(id: string) {
    await api(`/branches/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: editingName }),
    });
    setEditingId(null);
    await load();
  }

  if (status === "loading") {
    return <Skeleton className="h-48" />;
  }
  if (status === "error") {
    return <ErrorState description={error} onRetry={() => void load()} />;
  }

  return (
    <>
      <PageHeader title="Branches" description="Locations for this restaurant." />
      <Card className="mb-6">
        <form className="flex max-w-md items-end gap-3" onSubmit={createBranch}>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="branch-name">Name</Label>
            <Input
              id="branch-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <Button type="submit">Add</Button>
        </form>
      </Card>
      {branches.length === 0 ? (
        <EmptyState title="No branches" description="Add the first location above." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>POS lock (min)</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell>
                  {editingId === branch.id ? (
                    <Input
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                    />
                  ) : (
                    branch.name
                  )}
                </TableCell>
                <TableCell>{branch.posIdleTimeoutMinutes}</TableCell>
                <TableCell>
                  {editingId === branch.id ? (
                    <Button size="sm" onClick={() => void saveEdit(branch.id)}>
                      Save
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingId(branch.id);
                        setEditingName(branch.name);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
