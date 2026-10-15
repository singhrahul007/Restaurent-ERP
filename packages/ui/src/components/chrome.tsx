"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../lib/cn";

export function Topbar({
  brand,
  start,
  end,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  brand: ReactNode;
  start?: ReactNode;
  end?: ReactNode;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-[var(--z-sticky)] flex h-16 items-center gap-4 border-b border-border/80 bg-surface/80 backdrop-blur-xl px-5 transition-all shadow-[var(--shadow-sm)]",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-3 font-semibold text-fg-primary tracking-tight">{brand}</div>
      <div className="flex min-w-0 flex-1 items-center">{start}</div>
      <div className="flex items-center gap-3">{end}</div>
    </header>
  );
}

export function Sidebar({
  children,
  footer,
  className,
}: {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "flex w-64 shrink-0 flex-col border-r border-border/80 bg-surface/90 backdrop-blur-md",
        className,
      )}
    >
      <nav className="flex flex-1 flex-col gap-1.5 p-3">{children}</nav>
      {footer ? <div className="border-t border-border/80 p-3 bg-surface/50">{footer}</div> : null}
    </aside>
  );
}

export function SidebarItem({
  href,
  active,
  icon,
  badge,
  children,
  className,
  asChild = false,
  ...props
}: HTMLAttributes<HTMLElement> & {
  href?: string;
  active?: boolean;
  icon?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  asChild?: boolean;
}) {
  const styles = cn(
    "group flex min-h-[var(--touch-min)] items-center gap-3 rounded-[var(--radius-md)] px-3.5 py-2 text-sm font-medium text-fg-secondary transition-all duration-150 hover:bg-elevated/70 hover:text-fg-primary",
    active &&
      "bg-accent/15 text-accent font-semibold shadow-sm hover:bg-accent/20 hover:text-accent border border-accent/20",
    className,
  );

  const inner = (
    <>
      {icon ? (
        <span
          className={cn(
            "size-4 shrink-0 transition-transform group-hover:scale-110",
            active ? "text-accent" : "text-fg-muted group-hover:text-fg-primary",
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="flex-1 truncate">{children}</span>
      {badge ? <span className="ml-auto shrink-0">{badge}</span> : null}
    </>
  );

  if (asChild) {
    return (
      <Slot className={styles} {...props}>
        {children}
      </Slot>
    );
  }

  if (href) {
    return (
      <a href={href} className={styles} {...(props as HTMLAttributes<HTMLAnchorElement>)}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" className={styles} {...(props as HTMLAttributes<HTMLButtonElement>)}>
      {inner}
    </button>
  );
}

export function AppFrame({
  topbar,
  sidebar,
  children,
}: {
  topbar: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-fg-primary selection:bg-accent/30 selection:text-white">
      {topbar}
      <div className="flex min-h-0 flex-1">
        {sidebar}
        <main className="min-w-0 flex-1 p-6 md:p-8 animate-fadeIn">{children}</main>
      </div>
    </div>
  );
}
