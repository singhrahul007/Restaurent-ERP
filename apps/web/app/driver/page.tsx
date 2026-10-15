"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Skeleton,
} from "@niva/ui";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  DollarSign,
  MapPin,
  Power,
  RefreshCw,
  User,
} from "lucide-react";
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
  const [toggling, setToggling] = useState(false);

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
    setToggling(true);
    try {
      const next = await api<{ online: boolean }>("/delivery/me/shift", {
        method: "POST",
        body: JSON.stringify({ online: !online }),
      });
      setOnline(next.online);
    } catch {
      // ignore or alert
    } finally {
      setToggling(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-lg p-4 space-y-4">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-lg p-4">
        <ErrorState description={error} onRetry={() => void load()} />
      </div>
    );
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4 min-h-screen pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/80">
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-fg-secondary hover:text-fg-primary"
        >
          <ArrowLeft className="size-3.5" />
          Hub
        </Link>
        <div className="flex items-center gap-2">
          <Bike className="size-4 text-accent" />
          <span className="font-display font-bold text-sm">Rider Console</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void load()} className="p-1.5">
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      {/* Online / Offline Shift Status Card */}
      <Card
        variant="glass"
        className={`p-4 transition-all duration-300 border ${
          online ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/80 bg-surface/80"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-11 items-center justify-center rounded-2xl transition-colors ${
                online
                  ? "bg-emerald-500/20 text-emerald-400 shadow-md shadow-emerald-500/20"
                  : "bg-surface text-fg-muted"
              }`}
            >
              <Power className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-fg-primary">
                  {online ? "On Active Duty" : "Offline"}
                </span>
                <Badge variant={online ? "success" : "default"} dot pulse={online} size="sm">
                  {online ? "Ready for Trips" : "Shift Paused"}
                </Badge>
              </div>
              <p className="text-xs text-fg-muted mt-0.5">
                {online ? "Auto-assignment enabled" : "Go online to receive drop-offs"}
              </p>
            </div>
          </div>

          <Button
            variant={online ? "danger" : "gradient"}
            size="sm"
            disabled={toggling}
            onClick={() => void toggle()}
            className="shadow-sm font-semibold"
          >
            {online ? "Go Offline" : "Go Online"}
          </Button>
        </div>
      </Card>

      {/* Jobs Section */}
      <div className="mt-2">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-fg-muted">
            Assigned Deliveries ({jobs.length})
          </h2>
          {jobs.length > 0 && (
            <Badge variant="primary" size="sm">
              Live Priority
            </Badge>
          )}
        </div>

        {jobs.length === 0 ? (
          <Card variant="glass" className="p-8 text-center">
            <Bike className="mx-auto size-12 text-fg-muted/40 mb-3 animate-float" />
            <h3 className="text-base font-bold text-fg-primary">No Active Assignments</h3>
            <p className="text-xs text-fg-muted max-w-xs mx-auto mt-1">
              Stay online. When the kitchen or dispatcher assigns an order, it will appear here immediately.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/driver/${job.id}`}
                  className="group block rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-sm backdrop-blur-md transition-all duration-200 hover:border-accent/50 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <Badge
                      variant={
                        job.status === "DELIVERED"
                          ? "success"
                          : job.status === "OUT_FOR_DELIVERY"
                          ? "primary"
                          : "warning"
                      }
                      size="sm"
                    >
                      {job.status}
                    </Badge>
                    <span className="font-mono text-xs text-fg-muted">
                      #{job.id.slice(0, 8)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-start gap-2.5">
                    <User className="size-4 text-accent shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-bold text-base text-fg-primary group-hover:text-accent transition-colors">
                        {job.customerName ?? "Guest Customer"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-start gap-2.5 text-xs text-fg-muted">
                    <MapPin className="size-4 shrink-0 text-fg-muted mt-0.5" />
                    <p className="line-clamp-2 leading-relaxed">{job.addressLine}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-400">
                      <DollarSign className="size-3.5" />
                      COD: ₹{(job.codAmountMinor / 100).toFixed(0)}
                    </div>

                    <div className="flex items-center gap-1 text-xs font-semibold text-accent group-hover:underline">
                      <span>View Drop-off</span>
                      <ArrowRight className="size-3.5" />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
