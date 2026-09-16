import Link from "next/link";
import { AppShell } from "@niva/ui";

export default function HomePage() {
  return (
    <AppShell shell="owner">
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 px-6">
        <p className="text-sm font-medium uppercase tracking-wide text-fg-muted">Niva</p>
        <h1 className="font-display text-[length:var(--text-2xl)] font-semibold text-fg-primary">
          Restaurant operating system
        </h1>
        <p className="max-w-xl text-fg-secondary">
          Sign in, then use Setup to add restaurants, staff, and menu items.
        </p>
        <Link href="/dashboard" className="text-accent">
          Owner dashboard
        </Link>
        <Link href="/ops" className="text-accent">
          Manager ops
        </Link>
        <Link href="/login" className="text-accent">
          Sign in
        </Link>
        <Link href="/setup/restaurant" className="text-accent">
          Setup
        </Link>
        <Link href="/pos" className="text-accent">
          POS
        </Link>
        <Link href="/kds" className="text-accent">
          Kitchen
        </Link>
        <Link href="/driver" className="text-accent">
          Driver
        </Link>
      </main>
    </AppShell>
  );
}
