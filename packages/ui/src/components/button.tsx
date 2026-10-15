"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-all duration-[var(--duration-fast)] ease-[var(--easing-standard)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 select-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-white hover:bg-accent-hover shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-glow)] rounded-[var(--radius-md)]",
        gradient:
          "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white font-semibold hover:opacity-95 shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-glow)] rounded-[var(--radius-md)]",
        secondary:
          "bg-elevated text-fg-primary border border-border hover:border-border-strong hover:bg-elevated/80 rounded-[var(--radius-md)] shadow-[var(--shadow-sm)]",
        outline:
          "border border-border-strong bg-transparent text-fg-primary hover:bg-surface/80 rounded-[var(--radius-md)]",
        ghost: "text-fg-secondary hover:bg-surface hover:text-fg-primary rounded-[var(--radius-md)]",
        glass:
          "bg-white/10 backdrop-blur-md text-fg-primary border border-white/15 hover:bg-white/15 rounded-[var(--radius-md)] shadow-sm",
        danger: "bg-danger text-white hover:opacity-90 shadow-[var(--shadow-sm)] rounded-[var(--radius-md)]",
        success: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-[var(--shadow-sm)] rounded-[var(--radius-md)]",
      },
      size: {
        sm: "h-8.5 px-3 text-xs rounded-[var(--radius-sm)]",
        md: "h-10 min-h-[var(--touch-min)] px-4 text-[length:var(--text-sm)]",
        lg: "h-12 min-h-[var(--touch-min)] px-6 text-[length:var(--text-md)] font-semibold",
        icon: "size-[var(--touch-min)] rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, type = "button", ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : type}
      ref={ref}
      {...props}
    />
  );
});

export { buttonVariants };
