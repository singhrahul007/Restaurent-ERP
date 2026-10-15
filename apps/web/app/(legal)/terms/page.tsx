import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Review the terms, conditions, and enterprise SaaS service level agreements governing use of the MR.Genious Restaurant ERP system.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <article className="prose prose-invert max-w-none space-y-8 text-fg-secondary">
      <header className="border-b border-border/80 pb-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-accent">
          Legal Agreement & Service Terms
        </div>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-extrabold text-fg-primary">
          Terms and Conditions of Service
        </h1>
        <p className="mt-2 text-xs text-fg-muted font-mono">
          Last Updated: October 16, 2026 | Version 2.4 (Enterprise Edition)
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-fg-primary">1. Agreement to Terms</h2>
        <p className="text-sm leading-relaxed">
          These Terms and Conditions (&quot;Terms&quot;) constitute a legally binding agreement between MR.Genious
          Technologies (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) and the commercial subscriber, restaurant operator,
          or licensee (&quot;Client&quot;, &quot;Merchant&quot;, &quot;you&quot;). By accessing or utilizing the MR.Genious Point of Sale (POS),
          Kitchen Display System (KDS), Rider Dispatch Tower, Inventory, and Executive ERP suite (collectively, the
          &quot;Platform&quot;), you acknowledge that you have read, understood, and agreed to be bound by these Terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-fg-primary">2. SaaS Subscription & Account Provisioning</h2>
        <p className="text-sm leading-relaxed">
          The Platform is supplied on a multi-tenant Software-as-a-Service (SaaS) subscription model. Merchant accounts
          are provisioned with role-based access control (RBAC). The Merchant is solely responsible for maintaining the
          confidentiality of administrative credentials and PIN codes issued to cashiers, waitstaff, and kitchen personnel.
        </p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li><strong>Store Tenancy:</strong> Each tenant environment operates with isolated logical barriers and row-level database security.</li>
          <li><strong>Offline Station Cache:</strong> Workstation local storage holds offline cached data strictly for failover purposes during telecommunications disruption. Merchant agrees to synchronize offline tickets once connectivity is restored.</li>
          <li><strong>Acceptable Use:</strong> Merchant shall not reverse engineer, decompile, benchmark for competitive research, or expose automated scrapers to Platform endpoints.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-fg-primary">3. Billing, Fees & Payment Processing</h2>
        <p className="text-sm leading-relaxed">
          Subscription fees for MR.Genious software licenses, multi-branch add-ons, and connected hardware registers are
          billed monthly or annually in advance. All fees are exclusive of applicable statutory taxes (GST, VAT, or local sales taxes),
          which will be invoiced to Merchant in according with prevailing regional legislation.
        </p>
        <p className="text-sm leading-relaxed">
          For card processing, UPI, or third-party online delivery integrations (e.g. Swiggy, Zomato, UberEats, Stripe, Razorpay),
          Merchant enters into direct merchant service agreements with the respective gateway. MR.Genious acts solely as
          the integration orchestration software layer and does not custody customer funds.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-fg-primary">4. Hardware Compatibility & Offline Terminals</h2>
        <p className="text-sm leading-relaxed">
          MR.Genious supports industry-standard ESC/POS thermal receipt printers (Epson, Star Micronics), barcode scanners,
          and touch display hardware. While the platform is engineered for resilience, Company is not liable for data loss
          arising from hardware terminal malfunction, power fluctuations, or unsupported third-party peripherals.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-fg-primary">5. Service Level Agreement (SLA) & Uptime</h2>
        <p className="text-sm leading-relaxed">
          Company commits to a 99.9% uptime target for cloud synchronization and API services, excluding scheduled
          maintenance windows announced at least 48 hours in advance. Emergency hotfixes and critical zero-day security
          patches may be deployed without prior notice to preserve platform integrity.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-fg-primary">6. Limitation of Liability</h2>
        <p className="text-sm leading-relaxed">
          To the maximum extent permissible by law, under no circumstances will Company be liable for indirect, incidental,
          punitive, or consequential damages, including loss of restaurant revenue, food spoilage, delayed kitchen tickets,
          or delivery driver disputes. In all events, Company&apos;s aggregate liability will not exceed the total fees paid
          by Merchant to Company during the three (3) months preceding the incident.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-fg-primary">7. Governing Law & Dispute Resolution</h2>
        <p className="text-sm leading-relaxed">
          These Terms are governed by and construed in accordance with the laws of the applicable jurisdiction stated in
          Merchant&apos;s commercial contract order form. Any disputes shall first undergo good-faith mediation before
          initiating binding arbitration.
        </p>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-6">
        <h2 className="text-xl font-bold text-fg-primary">8. Contact Legal Counsel</h2>
        <p className="text-sm text-fg-muted">
          For legal inquiries, contractual amendments, or enterprise master service agreements (MSA), contact:
          <br />
          <span className="text-accent font-medium">legal@mrgenious.com</span> | MR.Genious Technologies Legal Compliance Team
        </p>
      </section>
    </article>
  );
}

