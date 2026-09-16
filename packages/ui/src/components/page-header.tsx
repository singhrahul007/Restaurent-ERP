import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export function PageHeader({
  title,
  description,
  actions,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[length:var(--text-xl)] font-semibold text-fg-primary">
          {title}
        </h1>
        {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
