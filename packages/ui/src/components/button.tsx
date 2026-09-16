"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-[background-color,opacity,transform] duration-[var(--duration-fast)] ease-[var(--easing-standard)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-fg-inverse hover:bg-accent-hover rounded-[var(--radius-md)]",
        secondary:
          "bg-elevated text-fg-primary border border-border hover:border-border-strong rounded-[var(--radius-md)]",
        outline:
          "border border-border-strong bg-transparent text-fg-primary hover:bg-surface rounded-[var(--radius-md)]",
        ghost: "text-fg-secondary hover:bg-surface hover:text-fg-primary rounded-[var(--radius-md)]",
        danger: "bg-danger text-fg-inverse hover:opacity-90 rounded-[var(--radius-md)]",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-10 min-h-[var(--touch-min)] px-4 text-[length:var(--text-md)]",
        lg: "h-12 min-h-[var(--touch-min)] px-5 text-[length:var(--text-lg)]",
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
