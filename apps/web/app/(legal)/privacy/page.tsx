import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how MR.Genious collects, safeguards, and processes operational and personal data in compliance with GDPR, CCPA, and DPDP.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <article className="prose prose-invert max-w-none space-y-8 text-fg-secondary">
      <header className="border-b border-border/80 pb-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-accent">
          Data Governance & Privacy
        </div>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-extrabold text-fg-primary">
          Privacy Policy
        </h1>
        <p className="mt-2 text-xs text-fg-muted font-mono">
          Effective Date: October 16, 2026 | Compliant with GDPR, CCPA & DPDP
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-fg-primary">1. Overview and Scope</h2>
        <p className="text-sm leading-relaxed">
          MR.Genious Technologies (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is dedicated to protecting the privacy and security of
          merchants, employees, riders, and dining customers whose data is processed through our Restaurant ERP suite.
          This Privacy Policy explains what personal and operational information we collect, why we collect it, how it is
          safeguarded, and your statutory data rights.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-fg-primary">2. Categories of Information Processed</h2>
        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-border/70 bg-surface/40 p-4">
            <h3 className="font-semibold text-fg-primary">A. Restaurant Merchant & Staff Data</h3>
            <p className="mt-1 text-fg-muted">
              Business names, registered GST/VAT tax identification numbers, store manager contact emails, cashier PINs,
              role entitlements, employee clock-in/out timestamps, and operational audit logs.
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-surface/40 p-4">
            <h3 className="font-semibold text-fg-primary">B. Dining Guest & Customer Data</h3>
            <p className="mt-1 text-fg-muted">
              Phone numbers collected during queue token check-in, delivery customer addresses, order histories, table notes,
              and dietary allergy tags. <em>Note: Payment card details are tokenized by PCI-DSS Level 1 compliant gateways; MR.Genious never stores raw CVVs or card numbers.</em>
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-surface/40 p-4">
            <h3 className="font-semibold text-fg-primary">C. Rider Fleet Geolocation Data</h3>
            <p className="mt-1 text-fg-muted">
              Real-time GPS telemetry from active delivery riders for live dispatch tower tracking and accurate estimated delivery times (ETA). Location tracking is deactivated once the delivery shift is ended.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-fg-primary">3. Purpose of Processing</h2>
        <p className="text-sm leading-relaxed">We process operational data strictly to:</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Facilitate real-time kitchen display routing, bill splitting, and tax invoice generation.</li>
          <li>Power automated SMS notifications for table queue token updates and delivery OTP verification.</li>
          <li>Detect billing anomalies, internal inventory shrinkage, and cash drawer discrepancies.</li>
          <li>Ensure multi-tenant isolation through Postgres Row-Level Security (RLS) policies.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-fg-primary">4. Data Sharing & Third-Party Processors</h2>
        <p className="text-sm leading-relaxed">
          We do not sell, rent, or trade merchant or patron data. Data is shared solely with vetted sub-processors essential
          for service execution:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li><strong>Cloud Infrastructure:</strong> High-availability secure cloud hosting in enterprise data centers.</li>
          <li><strong>SMS/Communication:</strong> Telephony providers for token waitlist and dispatch updates.</li>
          <li><strong>Payment Processors:</strong> Secure tokenized gateways for card, UPI, and digital wallet settlements.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-fg-primary">5. Data Retention & Merchant Rights</h2>
        <p className="text-sm leading-relaxed">
          Order transactions and tax invoices are retained in accordance with statutory accounting requirements (typically 7 years).
          Merchants and patrons retain the right under GDPR/DPDP to request export of their personal data or request anonymization
          upon business closure.
        </p>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-6">
        <h2 className="text-xl font-bold text-fg-primary">6. Data Protection Officer (DPO)</h2>
        <p className="text-sm text-fg-muted">
          For privacy concerns, data subject access requests (DSAR), or regulatory inquiries, contact our Privacy Office:
          <br />
          <span className="text-accent font-medium">privacy@mrgenious.com</span> | MR.Genious Data Protection Office
        </p>
      </section>
    </article>
  );
}

