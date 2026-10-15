import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, FileText, Lock, HelpCircle, RefreshCcw } from "lucide-react";

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Service", icon: FileText },
  { href: "/privacy", label: "Privacy Policy", icon: Lock },
  { href: "/refund-policy", label: "Refund & Cancellation", icon: RefreshCcw },
  { href: "/security", label: "Security & Compliance", icon: Shield },
  { href: "/faqs", label: "Help & FAQs", icon: HelpCircle },
];

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-fg-primary selection:bg-accent/30 selection:text-white">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-medium text-fg-muted hover:text-accent transition-colors"
            >
              <ArrowLeft className="size-4" />
              <span>Back to ERP</span>
            </Link>
            <div className="h-4 w-px bg-border/80" />
            <Link href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="MR.Genious Logo" className="h-7 w-auto object-contain" />
              <span className="font-display font-bold text-sm tracking-tight hidden sm:inline">
                MR.Genious Trust Center
              </span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1 text-xs">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 rounded-lg text-fg-secondary hover:text-fg-primary hover:bg-surface/60 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap gap-2 pb-6 border-b border-border/60 md:hidden">
          {LEGAL_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-surface/50 px-2.5 py-1 text-xs text-fg-secondary hover:border-accent/40 hover:text-accent transition-colors"
              >
                <Icon className="size-3" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>

        {children}
      </div>

      {/* Footer */}
      <footer className="mt-20 border-t border-border/60 bg-surface/30 py-8 text-center text-xs text-fg-muted">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} MR.Genious Technologies Inc. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <Link href="/terms" className="hover:underline">Terms</Link>
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            <Link href="/refund-policy" className="hover:underline">Refund Policy</Link>
            <Link href="/security" className="hover:underline">Security</Link>
            <Link href="/faqs" className="hover:underline">FAQs</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

