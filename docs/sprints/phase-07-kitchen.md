# Phase 7 — Kitchen Display System (KDS), Expediter & Floor Orchestration

The kitchen is where profitability and customer satisfaction are made or broken. Phase 7 transforms the traditional paper ticket chaos into an intelligent, multi-station Kitchen Display System (KDS) with station routing, preparation pacing timers, an expediter (expo) consolidation screen, and waiter runner alerts.

---

## T-0701 Station-Based Ticket Routing & Course Pacing Schema

**Objective:** Database schema and routing engine that splits a single customer order into station-specific KOT tickets (e.g. Grill Station, Fryer, Pizza/Oven, Salad/Cold Bar, Beverage Bar) with course pacing (Starters vs. Mains).  
**Revenue Impact:** Eliminates meal timing delays where appetizers and entrees arrive at the same time, increasing drink and dessert re-orders.  
**Scope:**
- `kitchen_tickets`: `id`, `order_id`, `branch_id`, `station_id`, `ticket_number`, `status` (`QUEUED`, `IN_PROGRESS`, `READY`, `SERVED`, `CANCELLED`), `course` (`STARTER`, `MAIN`, `DESSERT`), `target_prep_time_minutes`, `started_at`, `completed_at`.
- `kitchen_ticket_items`: `ticket_id`, `order_item_id`, `quantity`, `custom_instructions`, `status`.
- Automatic routing: items mapped to stations via menu category or item tags.
**Deps:** T-0608  
**Files Likely Affected:**
- `packages/database/src/schema/kitchen.ts`
- `apps/api/src/modules/kitchen/router.ts`
**AC:**
1. Created automatically in the same transaction as order confirmation or via the outbox worker.
2. An order with both a cocktail and a steak generates separate tickets for the Bar KDS and the Grill KDS with unified order cross-references.

---

## T-0702 Kitchen APIs, Prep-State Mutators & Cook Timers

**Objective:** REST and WebSocket-backed endpoints for line cooks to bump items, mark tickets in preparation, request ingredient restocks, or flag delays.  
**Revenue Impact:** Gives restaurant managers real-time visibility into kitchen bottleneck stations to optimize staffing.  
**Scope:**
- Endpoints: `GET /api/kitchen/tickets` (filtered by station), `PATCH /api/kitchen/tickets/:id/bump` (advances state), `PATCH /api/kitchen/items/:id/status`.
- Strict security: `kitchen.view` and `kitchen.update` permissions; financial data (prices, totals, customer payment methods) is stripped from payloads.
**Deps:** T-0701  
**Files Likely Affected:**
- `apps/api/src/modules/kitchen/tickets.ts`
- `packages/validation/src/kitchen.ts`
**AC:**
1. Strips all monetary and billing data from payloads sent to kitchen devices.
2. Cook bump actions update `started_at` and `completed_at` timestamps to log accurate prep-duration metrics.

---

## T-0703 Low-Latency Station Realtime Streaming & Audio Chimes

**Objective:** WebSocket streaming layer broadcasting instant ticket updates isolated by branch and station channel (`kitchen:{branchId}:{stationId}`).  
**Revenue Impact:** Instant order receipt in the kitchen within 150ms of POS punch reduces guest wait time and increases dinner turnover speed.  
**Scope:**
- Socket.IO with Redis pub/sub adapter.
- Audio cues: distinct chimes for New Ticket, Priority Rush Ticket, and Order Modification / Void alert.
- Multi-station heartbeat to detect if a kitchen tablet loses WiFi connection.
**Deps:** T-0702, T-0010  
**Files Likely Affected:**
- `apps/api/src/services/realtime/kitchen-emitter.ts`
- `apps/web/hooks/use-kitchen-socket.ts`
**AC:**
1. Strict tenant and branch isolation: Station A never receives broadcast events intended for Station B or another restaurant.
2. Reconnection logic automatically re-syncs unacknowledged tickets if connection drops for up to 10 minutes.

---

## T-0704 Touch-Optimized KDS Line Screen UI

**Objective:** High-contrast, touch-optimized visual screen designed for hot, steamy commercial kitchen environments (large tap targets, color-coded urgency timers, dark mode).  
**Revenue Impact:** Speeds up line-cook item preparation and eliminates misread handwritten modification requests (e.g. "NO ONIONS - ALLERGY").  
**Scope:**
- Timer color coding: Green (0-8 mins), Amber/Orange (8-15 mins), Flashing Red (>15 mins overdue).
- Allergy and critical modifier highlighting in prominent high-visibility warning pill badges.
- All-day summary view: displays consolidated total quantity of dishes currently to be cooked (e.g., "7x Classic Burgers, 4x Margherita Pizzas").
**Deps:** T-0307, T-0703  
**Files Likely Affected:**
- `apps/web/app/kds/page.tsx`
- `packages/ui/src/components/kds-ticket-card.tsx`
**AC:**
1. Supports full physical bump bar keyboards (1-9 number keys, enter, space) as well as touchscreens.
2. All-day summary modal togglable with a single tap for head chef volume forecasting.

---

## T-0705 Expediter (Expo) Master Screen & Runner Notification

**Objective:** Centralized Expediter screen that consolidates items from all stations for a single order, verifies full tray completion, and triggers waiter runner notifications.  
**Revenue Impact:** Guarantees food is served piping hot, stopping guest complaints, cold-food returns, and expensive meal remakes.  
**Scope:**
- Consolidated view: shows when Burger (Grill) is ready while Fries (Fryer) are still cooking.
- When all items for an order are marked ready, Expo marks order `READY_TO_RUN`.
- Automatically fires runner alert (push notification to Waiter Mobile App / SMS / buzzer display).
**Deps:** T-0704  
**Files Likely Affected:**
- `apps/web/app/kds/expo/page.tsx`
- `apps/api/src/modules/kitchen/expo.ts`
**AC:**
1. Expo screen clearly flags missing or lagging items per table.
2. One-click "Recall" button to un-bump an accidentally cleared ticket.

---

## T-0706 Automatic Kitchen-to-Order State Machine Sync

**Objective:** Automatic synchronization between kitchen ticket completions and master order lifecycle (`READY` → `SERVED`).  
**Revenue Impact:** Enables front-of-house staff and managers to know the exact status of any table without walking into the kitchen to ask the chef.  
**Scope:**
- Event listener: when all child kitchen tickets are marked `COMPLETED`, transitions parent order status to `READY`.
- Emits WebSocket event to POS floor map, changing table color to indicate food is on its way to the guest.
**Deps:** T-0702, T-0602  
**Files Likely Affected:**
- `apps/api/src/modules/orders/sync-kitchen.ts`
**AC:**
1. Order state machine rules strictly enforced; partial completion updates progress percentage without premature `READY` transition.
2. Logs exact kitchen turnaround time (from punch to ready) for chef performance evaluation.

---

## T-0707 Mobile Captain App & Table-Side Order Punching

**Objective:** Mobile-optimized waiter tablet/smartphone app: waitstaff browse the digital menu, take orders directly at diner tables, punch special cooking instructions (e.g. "Less spicy", "No garlic"), and fire KOT directly to kitchen without running back to cashier counter.  
**Industry Benchmark (Petpooja Captain App & Toast Go):** Works on standard Android mobile devices over local Wi-Fi; enables instant table-side item re-ordering, billing request, and digital payment trigger.  
**Scope:**
- Responsive mobile web interface (`apps/web/app/captain/page.tsx`) with fast 4-digit PIN lock.
- Floor view showing waiter's assigned tables with live readiness alerts ("Food ready for Table 6").
- Table-side bill print trigger (signals counter thermal printer to print bill for guest).
**Deps:** T-0610, T-0406, T-0703  
**Files Likely Affected:**
- `apps/web/app/captain/page.tsx`
- `apps/api/src/modules/orders/captain.ts`
**AC:**
1. Waiter can punch KOT in under 15 seconds directly from diner's table.
2. Restricted to waiter's branch context with instant KOT fire verification.

