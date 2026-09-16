"use client";

import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { Button, ErrorState, Input, Label, PageHeader, Skeleton } from "@niva/ui";
import { ApiError, api } from "../../../lib/api";

type Job = {
  id: string;
  status: string;
  addressLine: string;
  phone: string | null;
  customerName: string | null;
  codAmountMinor: number;
  maps: { google: string; apple: string };
};

export default function DriverJobPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("Could not load job");
  const [job, setJob] = useState<Job | null>(null);
  const [otp, setOtp] = useState("");
  const [cod, setCod] = useState("");

  async function load() {
    setStatus("loading");
    try {
      const data = await api<Job>(`/deliveries/${params.id}`);
      setJob(data);
      setCod(String(data.codAmountMinor));
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load job");
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  async function pickup() {
    const data = await api<Job>(`/deliveries/${params.id}/pickup`, { method: "POST" });
    setJob(data);
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    const data = await api<Job>(`/deliveries/${params.id}/confirm`, {
      method: "POST",
      body: JSON.stringify({ otp, codCollectedMinor: Number(cod) }),
    });
    setJob(data);
    router.replace("/driver");
  }

  if (status === "loading") {
    return <Skeleton className="m-4 h-48" />;
  }
  if (status === "error" || !job) {
    return <ErrorState description={error} onRetry={() => void load()} />;
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <PageHeader title={job.customerName ?? "Delivery"} description={job.addressLine} />
      <p className="text-sm uppercase text-fg-muted">{job.status}</p>
      {job.phone ? (
        <a className="text-lg text-accent" href={`tel:${job.phone}`}>
          Call customer
        </a>
      ) : null}
      <div className="flex gap-3">
        <a className="text-accent" href={job.maps.google} target="_blank" rel="noreferrer">
          Google Maps
        </a>
        <a className="text-accent" href={job.maps.apple} target="_blank" rel="noreferrer">
          Apple Maps
        </a>
      </div>
      {job.status === "ASSIGNED" ? (
        <Button type="button" onClick={() => void pickup()}>
          Picked up
        </Button>
      ) : null}
      {job.status === "PICKED_UP" ? (
        <form className="flex flex-col gap-3" onSubmit={confirm}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="otp">OTP</Label>
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cod">COD collected (paise)</Label>
            <Input
              id="cod"
              inputMode="numeric"
              value={cod}
              onChange={(event) => setCod(event.target.value)}
              required
            />
          </div>
          <Button type="submit">Confirm delivery</Button>
        </form>
      ) : null}
    </main>
  );
}
