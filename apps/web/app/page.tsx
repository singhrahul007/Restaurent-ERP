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
          Foundation shell. Authentication, tenants, and role workspaces are implemented in
          later phases.
        </p>
        <a href="/login" className="text-accent">
          Sign in
        </a>
        <a href="/setup" className="text-accent">
          Setup
        </a>
        <a href="/pos" className="text-accent">
          POS
        </a>
        <a href="/kds" className="text-accent">
          Kitchen
        </a>
        <a href="/driver" className="text-accent">
          Driver
        </a>
      </main>
    </AppShell>
  );
}
