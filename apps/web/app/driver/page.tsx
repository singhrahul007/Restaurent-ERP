"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from "@niva/ui";
import { ApiError, api } from "../../lib/api";

type Job = {
  id: string;
  status: string;
  addressLine: string;
  customerName: string | null;
  codAmountMinor: number;
};

export default function DriverJobsPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("Could not load jobs");
  const [online, setOnline] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);

  async function load() {
    setStatus("loading");
    try {
      const [me, list] = await Promise.all([
        api<{ online: boolean }>("/delivery/me"),
        api<{ deliveries: Job[] }>("/delivery/me/jobs"),
      ]);
      setOnline(Boolean(me.online));
      setJobs(list.deliveries);
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load jobs");
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle() {
    const next = await api<{ online: boolean }>("/delivery/me/shift", {
      method: "POST",
      body: JSON.stringify({ online: !online }),
    });
    setOnline(next.online);
  }

  if (status === "loading") {
    return <Skeleton className="m-4 h-48" />;
  }
  if (status === "error") {
    return <ErrorState description={error} onRetry={() => void load()} />;
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <PageHeader
        title="Deliveries"
        description="Only jobs assigned to you."
        actions={
          <Button type="button" onClick={() => void toggle()}>
            {online ? "Online" : "Offline"}
          </Button>
        }
      />
      {jobs.length === 0 ? (
        <EmptyState title="No jobs" description="Go online and wait for an assignment." />
      ) : (
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/driver/${job.id}`}
                className="block rounded-[var(--radius-lg)] border border-border bg-elevated p-4"
              >
                <p className="text-sm font-medium uppercase text-fg-muted">{job.status}</p>
                <p className="text-lg font-semibold">{job.customerName ?? "Guest"}</p>
                <p className="text-fg-secondary">{job.addressLine}</p>
                <p className="mt-2 text-sm">COD ₹{(job.codAmountMinor / 100).toFixed(0)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
