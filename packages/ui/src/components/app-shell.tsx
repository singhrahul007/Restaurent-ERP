import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export const SHELLS = ["owner", "platform", "pos", "kds", "driver"] as const;
export type ShellName = (typeof SHELLS)[number];

export function AppShell({
  shell = "owner",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { shell?: ShellName }) {
  return (
    <div
      data-shell={shell}
      className={cn("min-h-screen bg-canvas text-fg-primary", className)}
      {...props}
    />
  );
}
