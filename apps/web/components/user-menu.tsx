"use client";

import { useEffect, useState } from "react";
import { LogOut, User, Shield, ChevronDown } from "lucide-react";
import { Badge, Button } from "@niva/ui";
import { getCachedMe, loadSession, logout, type Me } from "../lib/session";

export function UserMenu() {
  const [me, setMe] = useState<Me | null>(getCachedMe);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!me) {
      void loadSession()
        .then(setMe)
        .catch(() => {});
    }
  }, [me]);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
  }

  if (!me?.user) {
    return null;
  }

  const email = me.user.email;
  const initial = email.charAt(0).toUpperCase();
  const isOwner = me.memberships[0]?.isOwner ?? false;
  const roleTitle = me.user.isPlatformAdmin
    ? "Platform Admin"
    : isOwner
      ? "Owner"
      : me.memberships[0]?.roles[0] || "Staff";

  return (
    <div className="flex items-center gap-2.5">
      {/* User Info Capsule */}
      <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-surface/70 py-1 pl-1.5 pr-3 shadow-sm">
        <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-tr from-accent to-amber-500 font-bold text-xs text-white shadow-xs">
          {initial}
        </div>
        <div className="flex flex-col text-left">
          <span className="max-w-[130px] truncate text-xs font-semibold text-fg-primary leading-tight">
            {email}
          </span>
          <span className="text-[10px] text-fg-muted font-medium leading-none">
            {roleTitle}
          </span>
        </div>
      </div>

      {/* Logout Action Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleLogout}
        disabled={loggingOut}
        className="h-8.5 gap-1.5 px-3 text-xs text-fg-secondary hover:border-danger/40 hover:bg-danger/10 hover:text-danger transition-colors"
        title="Sign out of current account"
      >
        <LogOut className="size-3.5" />
        <span className="hidden sm:inline">{loggingOut ? "Signing out…" : "Log Out"}</span>
      </Button>
    </div>
  );
}

export function SidebarUserFooter() {
  const [me, setMe] = useState<Me | null>(getCachedMe);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!me) {
      void loadSession()
        .then(setMe)
        .catch(() => {});
    }
  }, [me]);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
  }

  const email = me?.user?.email ?? "User";
  const initial = email.charAt(0).toUpperCase();
  const isOwner = me?.memberships[0]?.isOwner ?? false;
  const roleTitle = me?.user?.isPlatformAdmin
    ? "Platform Admin"
    : isOwner
      ? "Restaurant Owner"
      : me?.memberships[0]?.roles[0] || "Staff";

  return (
    <div className="flex flex-col gap-2 pt-1">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-surface/60 p-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-accent to-amber-500 font-bold text-xs text-white">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-fg-primary">{email}</p>
            <p className="text-[10px] text-fg-muted font-medium">{roleTitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded p-1 text-fg-muted hover:bg-danger/10 hover:text-danger transition-colors"
          title="Sign out"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}

