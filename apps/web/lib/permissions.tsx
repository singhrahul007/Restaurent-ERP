"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { AppShell, Button, ErrorState } from "@niva/ui";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import {
  getCachedMe,
  hasAnyPermission,
  hasPermission,
  isPlatformAdmin,
  loadSession,
  type Me,
} from "./session";

export interface CanProps {
  permission?: string;
  anyPermissions?: string[];
  allPermissions?: string[];
  requirePlatformAdmin?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders children only if current user has the required permission(s).
 */
export function Can({
  permission,
  anyPermissions,
  allPermissions,
  requirePlatformAdmin,
  fallback = null,
  children,
}: CanProps) {
  const me = getCachedMe();
  if (!me) return fallback as React.JSX.Element | null;

  if (requirePlatformAdmin && !isPlatformAdmin()) {
    return fallback as React.JSX.Element | null;
  }

  if (permission && !hasPermission(permission)) {
    return fallback as React.JSX.Element | null;
  }

  if (anyPermissions && anyPermissions.length > 0 && !hasAnyPermission(anyPermissions)) {
    return fallback as React.JSX.Element | null;
  }

  if (allPermissions && allPermissions.length > 0) {
    const ok = allPermissions.every((p) => hasPermission(p));
    if (!ok) return fallback as React.JSX.Element | null;
  }

  return <>{children}</>;
}

export function usePermissions() {
  const [me, setMe] = useState<Me | null>(getCachedMe);

  useEffect(() => {
    if (!me) {
      loadSession().then(setMe).catch(() => {});
    }
  }, [me]);

  return {
    me,
    isPlatformAdmin: me?.user?.isPlatformAdmin || me?.permissions?.includes("platform.manage") || false,
    permissions: me?.permissions ?? [],
    hasPermission: (code: string) => {
      if (!me) return false;
      if (me.user.isPlatformAdmin) return true;
      return me.permissions.includes(code);
    },
    hasAnyPermission: (codes: string[]) => {
      if (!me) return false;
      if (me.user.isPlatformAdmin) return true;
      return codes.some((c) => me.permissions.includes(c));
    },
  };
}

/**
 * Access Denied screen matching the application's UX and dark glass theme.
 */
export function AccessDeniedView({
  requiredPermission,
  title = "Access Restricted",
  description,
}: {
  requiredPermission?: string;
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center animate-fade-in">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-danger/10 border border-danger/20 text-danger shadow-inner mb-4">
        <ShieldAlert className="size-7" />
      </div>
      <h2 className="font-display text-xl font-bold tracking-tight text-fg-primary">
        {title}
      </h2>
      <p className="mt-2 text-sm text-fg-muted max-w-md leading-relaxed">
        {description ||
          `You do not have the necessary permission${
            requiredPermission ? ` (${requiredPermission})` : ""
          } to access this module or action. Please contact your restaurant administrator if you believe this is an error.`}
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button variant="secondary" size="sm" asChild>
          <Link href="/">
            <Home className="size-3.5 mr-1.5" />
            Return to Hub
          </Link>
        </Button>
      </div>
    </div>
  );
}

