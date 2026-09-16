"use client";

import { type FormEvent, useEffect, useState } from "react";
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
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@niva/ui";
import { ApiError, api } from "../../../lib/api";

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export default function SuppliersSetupPage() {
  const [status, setStatus] = useState<"loading" | "empty" | "ready" | "error">("loading");
  const [error, setError] = useState("Could not load suppliers");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  async function load() {
    setStatus("loading");
    const restaurantId = window.localStorage.getItem("niva_restaurant_id");
    if (!restaurantId) {
      setStatus("empty");
      return;
    }
    try {
      const data = await api<{ suppliers: Supplier[] }>(
        `/restaurants/${restaurantId}/suppliers`,
      );
      setSuppliers(data.suppliers);
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load suppliers");
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    const restaurantId = window.localStorage.getItem("niva_restaurant_id");
    if (!restaurantId) {
      return;
    }
    await api(`/restaurants/${restaurantId}/suppliers`, {
      method: "POST",
      body: JSON.stringify({
        name,
        phone: phone || undefined,
        email: email || undefined,
      }),
    });
    setName("");
    setPhone("");
    setEmail("");
    setOpen(false);
    await load();
  }

  if (status === "loading") {
    return <Skeleton className="h-48" />;
  }
  if (status === "empty") {
    return (
      <EmptyState
        title="Select a restaurant"
        description="Create a restaurant first, then add suppliers."
      />
    );
  }
  if (status === "error") {
    return <ErrorState description={error} onRetry={() => void load()} />;
  }

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Organization-scoped vendors for purchase orders."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Add supplier</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New supplier</DialogTitle>
                <DialogDescription>Visible only inside this organization.</DialogDescription>
              </DialogHeader>
              <form className="flex flex-col gap-3" onSubmit={create}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sup-name">Name</Label>
                  <Input
                    id="sup-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sup-phone">Phone</Label>
                  <Input
                    id="sup-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sup-email">Email</Label>
                  <Input
                    id="sup-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <Button type="submit">Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      {suppliers.length === 0 ? (
        <EmptyState title="No suppliers" description="Add the first vendor." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell>{supplier.name}</TableCell>
                <TableCell>{supplier.phone ?? "—"}</TableCell>
                <TableCell>{supplier.email ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
