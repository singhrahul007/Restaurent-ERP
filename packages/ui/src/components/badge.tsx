"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 font-medium transition-colors select-none",
  {
    variants: {
      variant: {
        default: "bg-surface text-fg-secondary border border-border",
        primary: "bg-accent/15 text-accent border border-accent/25",
        success: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
        warning: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
        danger: "bg-rose-500/15 text-rose-400 border border-rose-500/25",
        info: "bg-sky-500/15 text-sky-400 border border-sky-500/25",
        purple: "bg-purple-500/15 text-purple-400 border border-purple-500/25",
        glass: "bg-white/5 backdrop-blur-md text-fg-primary border border-white/10 shadow-sm",
      },
      size: {
        sm: "px-2 py-0.5 text-xs rounded-full",
        md: "px-2.5 py-1 text-xs rounded-full font-semibold",
        lg: "px-3 py-1.5 text-sm rounded-full",
      },
      pulse: {
        true: "",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      pulse: false,
    },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    dot?: boolean;
    dotClassName?: string;
    children?: ReactNode;
  };

export function Badge({
  className,
  variant,
  size,
  pulse = false,
  dot = false,
  dotClassName,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, pulse }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full shrink-0",
            pulse && "animate-radar",
            variant === "success" && "bg-emerald-400",
            variant === "primary" && "bg-accent",
            variant === "warning" && "bg-amber-400",
            variant === "danger" && "bg-rose-400",
            variant === "info" && "bg-sky-400",
            variant === "purple" && "bg-purple-400",
            (!variant || variant === "default" || variant === "glass") && "bg-fg-muted",
            dotClassName,
          )}
        />
      )}
      {children}
    </span>
  );
}

