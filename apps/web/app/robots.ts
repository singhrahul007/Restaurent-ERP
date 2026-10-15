import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mrgenious.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/terms",
          "/privacy",
          "/refund-policy",
          "/security",
          "/faqs",
        ],
        disallow: [
          "/dashboard/",
          "/pos/",
          "/kds/",
          "/ops/",
          "/driver/",
          "/setup/",
          "/api/",
          "/dev/",
        ],
      },
      {
        // Explicitly allow AI search crawlers to index public documentation, legal, FAQs, and overview
        userAgent: [
          "GPTBot",
          "ClaudeBot",
          "PerplexityBot",
          "Applebot-Extended",
          "Google-Extended",
          "cohere-ai",
        ],
        allow: [
          "/",
          "/terms",
          "/privacy",
          "/refund-policy",
          "/security",
          "/faqs",
          "/llms.txt",
        ],
        disallow: [
          "/dashboard/",
          "/pos/",
          "/kds/",
          "/ops/",
          "/driver/",
          "/setup/",
          "/api/",
          "/dev/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

