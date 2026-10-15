import type { Metadata } from "next";
import { ShieldCheck, Database, KeyRound, Server, Activity, Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Security & Compliance Standards",
  description:
    "Explore how MR.Genious implements Postgres Row-Level Security (RLS), PCI-DSS compliance, RBAC, and offline cryptographic safeguards.",
  alternates: {
    canonical: "/security",
  },
};

export default function SecurityPage() {
  const SECURITY_PILLARS = [
    {
      icon: Database,
      title: "Postgres Row-Level Security (RLS)",
      description:
        "Every tenant partition is enforced at the database kernel layer. Even in the event of complex joins or subqueries, cross-tenant data leaks are mathematically impossible.",
    },
    {
      icon: Lock,
      title: "End-to-End Encryption in Transit & Rest",
      description:
        "All API transactions use TLS 1.3 with automated HSTS header enforcement. Storage volumes, automated backups, and disk volumes are encrypted with AES-256.",
    },
    {
      icon: KeyRound,
      title: "Granular RBAC & Role Segregation",
      description:
        "Strict separation between Cashiers, Kitchen Station Expeditors, Delivery Dispatchers, Store Managers, and Tenant Owners. Sensitive actions require supervisor PIN approval.",
    },
    {
      icon: ShieldCheck,
      title: "PCI-DSS Level 1 Gateway Integrations",
      description:
        "MR.Genious operates a zero-custody card model. Card information is never exposed to our web servers, operating entirely on tokenized iframes and encrypted SDKs.",
    },
    {
      icon: Server,
      title: "High Availability & Multi-Region Failover",
      description:
        "Real-time database replication, automated hourly snapshots, and sub-second WebSocket clustering ensure your billing counter never stalls during peak lunch or dinner rushes.",
    },
    {
      icon: Activity,
      title: "Immutable Audit Trails",
      description:
        "Every cash drawer open event, receipt void, manual bill discount, recipe adjustment, and role grant is written to an immutable append-only audit log.",
    },
  ];

  return (
    <article className="prose prose-invert max-w-none space-y-10 text-fg-secondary">
      <header className="border-b border-border/80 pb-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-accent">
          Architecture & Enterprise Trust
        </div>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-extrabold text-fg-primary">
          Security & Compliance Framework
        </h1>
        <p className="mt-2 text-xs text-fg-muted font-mono">
          Last Verified: October 16, 2026 | ISO 27001 Aligned & SOC-2 Ready
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-fg-primary">Enterprise Security Architecture</h2>
        <p className="text-sm leading-relaxed">
          In high-volume restaurant operations, downtime costs revenue, while data breaches destroy customer trust.
          MR.Genious was architected from inception around strict multi-tenancy, granular least-privilege access, and offline data integrity.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 not-prose mt-6">
          {SECURITY_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="rounded-2xl border border-border/70 bg-surface/40 p-5 backdrop-blur-sm transition-all hover:border-accent/40"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-3 text-base font-bold text-fg-primary">{pillar.title}</h3>
                <p className="mt-1 text-xs text-fg-muted leading-relaxed">{pillar.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-fg-primary">Responsible Vulnerability Disclosure</h2>
        <p className="text-sm leading-relaxed">
          We welcome collaboration with white-hat security researchers. If you discover a potential vulnerability within
          MR.Genious systems or endpoints, please disclose it to us responsibly without public dissemination:
        </p>
        <p className="text-sm text-fg-muted">
          PGP Key & Reporting Address: <span className="text-accent font-medium">security@mrgenious.com</span>
          <br />
          We commit to acknowledging reports within 24 hours and providing periodic remediation timelines.
        </p>
      </section>
    </article>
  );
}

