# UI / design system

Product visual identity: **Niva** — warm charcoal + ember accent (not a generic purple admin template). Operational surfaces (POS, KDS) diverge from analytics shells.

## Tokens (CSS variables on `:root`)

Define in `packages/ui` only. No ad-hoc hex in features.

```text
Color
  --bg-canvas, --bg-surface, --bg-elevated
  --bg-pos (neutral high-contrast workspace)
  --bg-kds (near-black)
  --fg-primary, --fg-secondary, --fg-muted, --fg-inverse
  --accent (ember), --accent-hover
  --success, --warning, --danger, --info
  --border, --border-strong
  --chart-1..6 (colorblind-safe)

Typography
  --font-sans (UI)
  --font-display (owner dashboard titles only, sparingly)
  --font-mono (order numbers, SKUs)
  Scale: 12 / 14 / 16 / 18 / 24 / 32 / 40
  POS actions: min 16px, touch targets 44px
  KDS: body ≥ 20px, ticket title ≥ 28px

Spacing: 4pt grid (4,8,12,16,24,32,48,64)
Radius: --radius-sm 6px, --md 10px, --lg 16px, --full
Shadow: --shadow-sm / --md only (no heavy glow)
Breakpoints: sm 640, md 768, lg 1024, xl 1280, 2xl 1536
Z-index: base 0, sticky 20, dropdown 40, overlay 50, modal 60, toast 70, kds-alert 80
Motion: --duration-fast 120ms, --med 200ms, --slow 320ms; easing standard. Respect prefers-reduced-motion.
```

## Shared components (`packages/ui`)

Button, IconButton, Input, Select, FormField, Table, Card, Modal, Sheet, Tabs, Toast, Skeleton, EmptyState, ErrorState, PageHeader, DataChart wrapper.

Charts: Recharts or similar **in web app**, tokenized colors. Useful metrics only.

## Shells (do not one-sidebar-all)

### Super Admin

Dense command center: KPI row, health, job failures, tenant table with filters. Dark professional, not restaurant-orange heavy.

### Owner

BI product: greeting, revenue/orders/AOV, trend chart, top items, low stock, branch compare. Spacious cards, subtle hover, skeleton/empty/error on every widget.

### Manager

Live ops: order board snapshot, kitchen SLA, staff on shift, alerts. More lists/timers than charts.

### Cashier / Receptionist

Full-width POS: category rail, search (keyboard `/`), item grid, cart column, table picker, pay. Large buttons, shortcuts, **minimal motion**. No decorative charts.

### Cook

Fullscreen KDS: columns New / Preparing / Ready, timers, priority, optional sound. No nav chrome, no revenue.

### Delivery

Mobile-first PWA: bottom nav, large online toggle, card list of jobs, map/deeplink, call, OTP input, COD. Thumb-zone primary actions.

## Dashboard grid (owner/manager)

Top bar: wordmark, search (owner), notifications, profile. Left nav role-specific. Main: 12-column grid. Cards: title, metric, delta, source period.

## States

Every data view: loading skeleton, empty illustration+CTA, error+retry. POS errors must be inline and recoverable (payment fail).

## Shell token overrides

Set `data-shell` on `AppShell` (`owner` | `platform` | `pos` | `kds` | `driver`). Variables are defined in `packages/ui/src/styles/tokens.css` only.

| Shell | Intent |
| --- | --- |
| `owner` | Warm canvas (default `:root`) |
| `platform` | Cool dark command center; ember is secondary, not the page field |
| `pos` | Neutral workspace (`--bg-pos`); motion durations shortened |
| `kds` | Near-black, high contrast (see below) |
| `driver` | Light, thumb-friendly; same accent as owner |

### KDS high contrast

- Background `#050505` / surface `#0b0b0a` with `--fg-primary` `#fafaf9` (body ≥ 20px via `--text-md: 1.25rem`).
- Ticket titles use `--text-xl` (1.75rem, ≥ 28px).
- Status: `--accent` amber `#f5c518`, `--success` `#4ade80`, `--danger` `#fb7185` on black for large-text contrast.
- No drop shadows. Alerts sit at `--z-kds-alert` (80). Do not use owner dashboard chrome on KDS.

## Focus and contrast notes

- `:focus-visible` uses `--focus-ring` (2px solid `--accent`) and `--focus-offset`. Do not remove outlines on buttons.
- Primary buttons are `--accent` on `--fg-inverse`. If a control sits on ember, use `--fg-inverse` text.
- Charts use `--chart-1`…`--chart-6` (Wong-style, colorblind-safer than rainbow).
- Feature code must not introduce hex; change tokens.css instead.

## Motion

`--duration-fast/med/slow` and `--easing-standard`. `prefers-reduced-motion: reduce` collapses CSS animation/transition. Framer presets (`FadeIn`, `ScaleIn`) skip decorative animation when `useReducedMotion()` is true.

