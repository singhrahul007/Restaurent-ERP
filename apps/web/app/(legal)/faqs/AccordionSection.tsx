"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FaqItem {
  category: string;
  question: string;
  answer: string;
}

export function AccordionSection({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", ...Array.from(new Set(items.map((i) => i.category)))];

  const filteredItems =
    selectedCategory === "All"
      ? items
      : items.filter((item) => item.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              selectedCategory === cat
                ? "bg-accent text-white shadow-sm"
                : "border border-border/70 bg-surface/40 text-fg-secondary hover:text-fg-primary hover:border-accent/40"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Accordion List */}
      <div className="space-y-3">
        {filteredItems.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={item.question}
              className="rounded-2xl border border-border/80 bg-surface/50 overflow-hidden transition-all duration-200 hover:border-accent/40"
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-surface/80"
              >
                <div className="flex items-center gap-3 pr-4">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface/90 text-accent">
                    <HelpCircle className="size-4" />
                  </div>
                  <span className="text-sm font-semibold text-fg-primary sm:text-base">
                    {item.question}
                  </span>
                </div>
                <ChevronDown
                  className={`size-4 text-fg-muted shrink-0 transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-accent" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="border-t border-border/60 bg-surface/30 px-5 py-4 text-xs sm:text-sm text-fg-secondary leading-relaxed">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

