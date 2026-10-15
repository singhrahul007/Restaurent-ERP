import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Return and Refund Policy",
  description:
    "Standardized policies regarding software subscriptions, terminal licenses, hardware peripherals, and dining order disputes for MR.Genious.",
  alternates: {
    canonical: "/refund-policy",
  },
};

export default function RefundPolicyPage() {
  return (
    <article className="prose prose-invert max-w-none space-y-8 text-fg-secondary">
      <header className="border-b border-border/80 pb-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-accent">
          Merchant & Order Settlement
        </div>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-extrabold text-fg-primary">
          Return & Refund Policy
        </h1>
        <p className="mt-2 text-xs text-fg-muted font-mono">
          Last Revised: October 16, 2026 | Industry Standard Foodtech & SaaS Terms
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-fg-primary">1. Overview of Two Distinct Refund Domains</h2>
        <p className="text-sm leading-relaxed">
          MR.Genious operates as a B2B SaaS restaurant management software. Therefore, our refund rules address two distinct tiers:
        </p>
        <ol className="list-decimal pl-5 space-y-1 text-sm">
          <li><strong>B2B Platform Subscriptions:</strong> Software subscription plans and POS register seat licenses paid by restaurant operators to MR.Genious.</li>
          <li><strong>Patron / Dining Order Transactions:</strong> Food & beverage orders placed by dining guests at merchant restaurants processed through the MR.Genious POS or online ordering.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-fg-primary">2. B2B SaaS Subscription Refunds</h2>
        <div className="space-y-3 text-sm">
          <p className="leading-relaxed">
            <strong>14-Day Evaluation Window:</strong> New restaurant chains subscribing to MR.Genious annual plans are eligible
            for a full refund of software subscription fees within fourteen (14) calendar days of initial account onboarding,
            provided system configuration assistance has been utilized.
          </p>
          <p className="leading-relaxed">
            <strong>Monthly Subscriptions:</strong> Monthly SaaS plans are billed recurringly and are non-refundable for partial
            billing periods. You may cancel your subscription at any time via the Store Setup workspace, after which you retain
            full system access until the end of the current billing cycle.
          </p>
          <p className="leading-relaxed">
            <strong>Hardware & Terminals:</strong> Physical peripherals (thermal receipt printers, barcode scanners, cash drawers)
            procured through certified hardware partners carry manufacturer warranties and are subject to the specific hardware distributor’s 30-day exchange policy for defective units.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-fg-primary">3. Dining Customer & Food Order Disputes</h2>
        <p className="text-sm leading-relaxed">
          MR.Genious provides the Point of Sale software infrastructure but is not the seller of food or beverage items.
          Individual dining refunds, table cancellations, or meal quality complaints are governed by the merchant restaurant&apos;s internal policy:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li><strong>Order Cancellation prior to Kitchen Preparation:</strong> If an order ticket has not yet been accepted by the Kitchen Display System (KDS), counter staff can cancel the ticket and initiate an instant tender reversal.</li>
          <li><strong>Food Preparation & Quality Disputes:</strong> Once items are prepared or bumped on the KDS, refund approvals require a Manager PIN authorization on the POS workstation.</li>
          <li><strong>Delivery Order OTP Failures:</strong> In cases of customer unavailability or incorrect address entry during fleet delivery, the refund is subject to merchant and rider dispatcher review.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-fg-primary">4. Refund Processing Timelines</h2>
        <p className="text-sm leading-relaxed">
          When an authorized refund is executed through the MR.Genious POS integration:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li><strong>Cash Tenders:</strong> Handled immediately at the counter upon supervisor sign-off.</li>
          <li><strong>Card & Online Gateway Payments:</strong> Processed back to original source accounts within 5 to 7 business days, subject to the card issuing bank&apos;s settlement schedule.</li>
          <li><strong>UPI / Instant Net-Banking:</strong> Usually settled within 24 to 48 banking hours.</li>
        </ul>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-6">
        <h2 className="text-xl font-bold text-fg-primary">5. Dispute Escalation</h2>
        <p className="text-sm text-fg-muted">
          For billing discrepancies or subscription refund requests:
          <br />
          <span className="text-accent font-medium">billing@mrgenious.com</span> | Commercial Accounts & Merchant Billing
        </p>
      </section>
    </article>
  );
}

