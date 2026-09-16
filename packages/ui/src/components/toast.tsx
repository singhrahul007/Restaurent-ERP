"use client";

import { Toaster as Sonner, toast } from "sonner";

export { toast };

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      style={{ zIndex: "var(--z-toast)" }}
      toastOptions={{
        classNames: {
          toast:
            "border border-border bg-elevated text-fg-primary shadow-[var(--shadow-md)]",
          title: "text-fg-primary",
          description: "text-fg-muted",
        },
      }}
    />
  );
}
