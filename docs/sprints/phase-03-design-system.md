# Phase 3 — Design system

## T-0301 CSS tokens

**Objective:** CSS variables per `ui-design-system.md` in `packages/ui`.  
**Deps:** T-0008  
**AC:** No feature-level hex in this task.

## T-0302 shadcn + wrappers

**Objective:** Install shadcn in web; re-export Button, Input, Card, Dialog, Table from `packages/ui` or `apps/web/components/ui` mapped to tokens.  
**Deps:** T-0301  
**AC:** Theme uses CSS variables.

## T-0303 Form primitives

**Objective:** RHF + Zod resolver example field components.  
**Deps:** T-0302  
**AC:** Accessible labels.

## T-0304 Feedback states

**Objective:** Skeleton, EmptyState, ErrorState, Toast.  
**Deps:** T-0302  
**AC:** Story or demo route `/dev/ui` (dev only).

## T-0305 Motion policy

**Objective:** Framer presets respecting `prefers-reduced-motion`.  
**Deps:** T-0301  
**AC:** Reduced motion disables decorative animation.

## T-0306 App chrome pieces

**Objective:** Topbar, Sidebar primitives **without** wiring all roles.  
**Deps:** T-0302  
**AC:** Composable; no fake data dashboards.

## T-0307 POS and KDS token themes

**Objective:** `[data-shell=pos|kds|driver|platform|owner]` theme overrides.  
**Deps:** T-0301  
**AC:** KDS high contrast documented.

## T-0308 Typography and focus

**Objective:** Focus rings, contrast check notes.  
**Deps:** T-0301  
**AC:** Keyboard focus visible on buttons.
