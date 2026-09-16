import type { SelectHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "h-10 w-full min-h-[var(--touch-min)] rounded-[var(--radius-md)] border border-border bg-elevated px-3 text-[length:var(--text-md)] text-fg-primary",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
