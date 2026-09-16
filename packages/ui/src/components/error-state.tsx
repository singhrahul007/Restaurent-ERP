"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  action,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-danger/40 bg-surface p-6",
        className,
      )}
    >
      <h2 className="text-lg font-semibold text-danger">{title}</h2>
      {description ? <p className="max-w-md text-sm text-fg-secondary">{description}</p> : null}
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      ) : (
        action
      )}
    </div>
  );
}
