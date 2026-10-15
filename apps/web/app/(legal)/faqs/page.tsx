import type { Metadata } from "next";
import { AccordionSection } from "./AccordionSection";

export const metadata: Metadata = {
  title: "Frequently Asked Questions (FAQs)",
  description:
    "Comprehensive answers regarding MR.Genious POS billing, offline mode, kitchen display systems, rider dispatching, hardware setup, and security.",
  alternates: {
    canonical: "/faqs",
  },
};

const FAQ_ITEMS = [
  {
    category: "POS & Billing",
    question: "Does the MR.Genious POS register work offline when the internet goes down?",
    answer:
      "Yes. The MR.Genious Point of Sale is built with local caching and offline capabilities. You can continue taking orders, punching table tickets, and generating thermal receipts. Once your internet connection restores, all local transactions automatically sync back to the cloud ERP with conflict-free timestamps.",
  },
  {
    category: "POS & Billing",
    question: "Can we split bills across multiple diners and payment tenders?",
    answer:
      "Yes. MR.Genious supports equal splits, itemized seat-level splits, and multi-tender checkouts combining Cash, Credit/Debit cards, UPI QR codes, customer loyalty points, and hotel room charges.",
  },
  {
    category: "Kitchen & KDS",
    question: "How does the Kitchen Display System (KDS) interact with the billing counter?",
    answer:
      "The KDS receives instant sub-second order tickets via WebSockets. Orders can be routed to separate prep stations (e.g., Grill, Fryer, Bar, Expediter). When kitchen chefs bump tickets, the status immediately reflects on the waiter tablets and manager ops screen.",
  },
  {
    category: "Queue & Waitlist",
    question: "How does the Queue & Waitlist feature handle customer check-in?",
    answer:
      "Guests can be entered into the digital waitlist at the host counter. The system calculates dynamic wait times based on historical table turn rates and sends SMS seating alerts when their table is ready. A live queue monitor screen can also be cast to a TV kiosk in your lobby.",
  },
  {
    category: "Fleet & Delivery",
    question: "Can we dispatch our own in-house delivery riders?",
    answer:
      "Yes. The Rider & Dispatch Tower allows managers to assign delivery orders to internal riders, view live rider GPS locations, calculate delivery transit times, verify delivery via OTP, and audit end-of-shift Cash-on-Delivery (COD) collections.",
  },
  {
    category: "Hardware & Printers",
    question: "What thermal receipt printers and hardware accessories are supported?",
    answer:
      "MR.Genious supports standard 58mm and 80mm ESC/POS thermal printers connected over USB, Ethernet (LAN), Bluetooth, or Wi-Fi (such as Epson, Star Micronics, Citizen, and generic ESC/POS units). It also integrates with handheld barcode scanners, digital weight scales, and electronic cash drawers.",
  },
  {
    category: "Security & Multi-Branch",
    question: "How is data isolated between different restaurant branches and franchises?",
    answer:
      "MR.Genious leverages PostgreSQL Row-Level Security (RLS) policies. Every database query enforces tenant and branch boundaries at the kernel level. Staff members only access their authorized branch workstation unless granted multi-outlet franchise owner roles.",
  },
  {
    category: "Billing & Subscriptions",
    question: "What happens if we need to add more branches or counters in the future?",
    answer:
      "You can scale effortlessly. Additional counters, kitchen prep stations, or branch locations can be added on-demand from the Store Setup dashboard without requiring server downtime or database migrations.",
  },
];

export default function FaqsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <article className="space-y-8">
      {/* Schema.org FAQPage JSON-LD for Search Engines and AI Crawlers */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="border-b border-border/80 pb-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-accent">
          Help & Knowledge Base
        </div>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-extrabold text-fg-primary">
          Frequently Asked Questions
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Common queries answered regarding POS operations, offline sync, hardware integration, and multi-branch management.
        </p>
      </header>

      <AccordionSection items={FAQ_ITEMS} />

      <div className="mt-12 rounded-2xl border border-border/80 bg-gradient-to-r from-surface via-elevated to-surface p-6 sm:p-8 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-lg font-bold text-fg-primary">Still have technical questions?</h3>
          <p className="text-xs text-fg-muted mt-1">
            Our foodtech systems engineering team is available 24/7 for merchant onboarding and workstation assistance.
          </p>
        </div>
        <a
          href="mailto:support@mrgenious.com"
          className="inline-flex items-center rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-accent/90 transition-colors shrink-0"
        >
          Contact Support Desk
        </a>
      </div>
    </article>
  );
}

