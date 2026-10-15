import type { ReactNode } from "react";
import type { Metadata } from "next";
import { DM_Sans, Fraunces, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@niva/ui";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans-face",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-face",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-face",
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mrgenious.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MR.Genious - Restaurant Operating System & ERP",
    template: "%s | MR.Genious Restaurant ERP",
  },
  description:
    "Enterprise-grade cloud & offline Restaurant POS, Kitchen Display System (KDS), Waitlist, Fleet Rider Dispatch, Inventory, and Multi-Branch Analytics ERP.",
  keywords: [
    "Restaurant ERP",
    "Restaurant Management System",
    "Cloud POS",
    "Kitchen Display System KDS",
    "Offline POS Billing",
    "Restaurant Inventory Management",
    "Foodtech Operating System",
    "Multi-Branch Restaurant Software",
  ],
  authors: [{ name: "MR.Genious Technologies" }],
  creator: "MR.Genious Technologies",
  publisher: "MR.Genious Technologies",
  applicationName: "MR.Genious ERP",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    title: "MR.Genious - High-Performance Restaurant Operating System & ERP",
    description:
      "Modern POS billing, realtime kitchen display, automated table waitlists, rider fleet dispatch, and multi-tenant restaurant intelligence.",
    siteName: "MR.Genious ERP",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "MR.Genious Restaurant Operating System & ERP",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MR.Genious - Restaurant Operating System & ERP",
    description:
      "All-in-one Point of Sale, Kitchen Display, Dispatch Tower, and Multi-Branch Analytics for modern dining establishments.",
    images: ["/logo.png"],
    creator: "@mrgenious",
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MR.Genious Restaurant ERP",
    operatingSystem: "Web, Windows, Linux, iOS, Android (Offline Capable)",
    applicationCategory: "BusinessApplication",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description:
      "Enterprise cloud and offline-capable Restaurant Operating System, POS Billing Register, Kitchen Display System (KDS), and Multi-Branch Analytics ERP.",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "320",
    },
  };

  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className="min-h-screen bg-canvas text-fg-primary antialiased"
        suppressHydrationWarning
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
