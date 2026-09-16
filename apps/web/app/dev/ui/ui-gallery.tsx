"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, Menu } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AppFrame,
  AppShell,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  ErrorState,
  FadeIn,
  IconButton,
  Input,
  Label,
  PageHeader,
  Select,
  SHELLS,
  Sidebar,
  SidebarItem,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextFormField,
  Topbar,
  toast,
  type ShellName,
} from "@niva/ui";

const exampleSchema = z.object({
  station: z.string().min(2, "Enter a station name"),
});

type ExampleValues = z.infer<typeof exampleSchema>;

export function UiGallery() {
  const [shell, setShell] = useState<ShellName>("owner");
  const form = useForm<ExampleValues>({
    resolver: zodResolver(exampleSchema),
    defaultValues: { station: "" },
  });

  return (
    <AppShell shell={shell}>
      <AppFrame
        topbar={
          <Topbar
            brand="Niva"
            start={
              <label className="flex items-center gap-2 text-sm text-fg-secondary">
                <span>Shell</span>
                <Select
                  aria-label="Preview shell theme"
                  value={shell}
                  onChange={(event) => setShell(event.target.value as ShellName)}
                  className="w-40"
                >
                  {SHELLS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </label>
            }
            end={
              <>
                <IconButton label="Notifications">
                  <Bell />
                </IconButton>
                <IconButton label="Open menu">
                  <Menu />
                </IconButton>
              </>
            }
          />
        }
        sidebar={
          <Sidebar>
            <SidebarItem active>Primitives</SidebarItem>
            <SidebarItem>Chrome</SidebarItem>
          </Sidebar>
        }
      >
        <FadeIn>
          <PageHeader
            title="UI gallery"
            description="Dev-only. Tokens, focus, motion, and shell themes."
          />
        </FadeIn>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Keyboard focus uses the accent ring.</CardDescription>
            </CardHeader>
            <div className="flex flex-wrap gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button onClick={() => toast("Saved", { description: "Tokenized toast" })}>
                Toast
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary">Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm</DialogTitle>
                    <DialogDescription>Uses overlay and modal z-index tokens.</DialogDescription>
                  </DialogHeader>
                  <Button>Continue</Button>
                </DialogContent>
              </Dialog>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Form field</CardTitle>
              <CardDescription>React Hook Form + Zod, labelled inputs.</CardDescription>
            </CardHeader>
            <form
              className="flex max-w-md flex-col gap-4"
              onSubmit={form.handleSubmit((values) => toast(`Station ${values.station}`))}
            >
              <TextFormField
                control={form.control}
                name="station"
                label="Station name"
                description="Shown on kitchen tickets."
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" className="font-mono" placeholder="NIV-001" />
              </div>
              <Button type="submit">Validate</Button>
            </form>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Table</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono">BR-1</TableCell>
                  <TableCell>Downtown</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-24" />
            <EmptyState title="No tickets" description="New orders will appear here." />
            <ErrorState
              description="Could not load tickets."
              onRetry={() => toast("Retry requested")}
            />
          </div>
        </div>
      </AppFrame>
    </AppShell>
  );
}
