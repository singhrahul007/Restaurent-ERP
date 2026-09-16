"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
};

export function IconButton({ label, className, children, ...props }: IconButtonProps) {
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={label}
      className={cn(className)}
      {...props}
    >
      {children}
    </Button>
  );
}
