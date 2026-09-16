import type { HTMLAttributes, ReactNode } from "react";
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
        "sticky top-0 z-[var(--z-sticky)] flex h-14 items-center gap-4 border-b border-border bg-surface px-4",
        className,
      )}
      {...props}
    >
      <div className="font-medium text-fg-primary">{brand}</div>
      <div className="flex min-w-0 flex-1 items-center">{start}</div>
      <div className="flex items-center gap-2">{end}</div>
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
        "flex w-56 shrink-0 flex-col border-r border-border bg-surface",
        className,
      )}
    >
      <nav className="flex flex-1 flex-col gap-1 p-2">{children}</nav>
      {footer ? <div className="border-t border-border p-2">{footer}</div> : null}
    </aside>
  );
}

export function SidebarItem({
  href,
  active,
  children,
  className,
}: {
  href?: string;
  active?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const styles = cn(
    "flex min-h-[var(--touch-min)] items-center rounded-[var(--radius-md)] px-3 text-sm text-fg-secondary",
    active && "bg-elevated text-fg-primary",
    className,
  );
  if (href) {
    return (
      <a href={href} className={styles}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={styles}>
      {children}
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
    <div className="flex min-h-screen flex-col">
      {topbar}
      <div className="flex min-h-0 flex-1">
        {sidebar}
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
