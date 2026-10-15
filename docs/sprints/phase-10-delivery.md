# Phase 10 — Direct Delivery, Driver Fleet & Zero-Commission D2C Storefront

High aggregator commissions (20% to 30% charged by Swiggy, Zomato, UberEats, DoorDash) severely erode restaurant net margins. Phase 10 builds a complete in-house direct-to-consumer (D2C) delivery engine: internal driver fleet dispatch, OTP-verified delivery handoffs, cash-on-delivery (COD) reconciliation, driver PWA, and direct online ordering.

---

## T-1001 Delivery Fleet Schema & Order Dispatch State Machine

**Objective:** Database schema supporting in-house delivery drivers, order dispatch states, geofenced branch delivery radiuses, and cash collection tracking.  
**Revenue Impact:** Bypasses 30% aggregator platform commissions, retaining 100% of delivery order profits within the restaurant.  
**Scope:**
- `delivery_agents`: `id`, `organization_id`, `branch_id`, `user_id`, `vehicle_type` (`BIKE`, `SCOOTER`, `CAR`), `license_plate`, `phone`, `current_status` (`OFFLINE`, `AVAILABLE`, `ON_TRIP`), `active_deliveries_count`.
- `deliveries`: `id`, `order_id`, `delivery_agent_id`, `status` (`UNASSIGNED`, `ASSIGNED`, `PICKED_UP`, `EN_ROUTE`, `DELIVERED`, `FAILED`, `RETURNED`), `customer_address_json`, `latitude`, `longitude`, `otp_hash`, `cod_expected_minor`, `cod_collected_minor`, `delivery_fee_minor`, `driver_tip_minor`, `picked_up_at`, `delivered_at`.
- Validation: delivery orders enforce presence of customer contact number and delivery address.
**Deps:** T-0602  
**Files Likely Affected:**
- `packages/database/src/schema/delivery.ts`
- `apps/api/src/modules/delivery/state-machine.ts`
**AC:**
1. Foreign key constraint links strictly to orders of type `DELIVERY`.
2. Drivers cannot be assigned to deliveries belonging to another organization.

---

## T-1002 Driver Online/Offline Availability & Geolocation Ping API

**Objective:** Endpoints allowing delivery riders to toggle duty status, report current battery/vehicle status, and broadcast background GPS coordinates.  
**Revenue Impact:** Maximizes fleet utilization by routing deliveries to the closest available rider.  
**Scope:**
- `POST /api/delivery/driver/status` (`is_online`: boolean).
- `POST /api/delivery/driver/location` (`latitude`, `longitude`, `heading`, `speed`).
- Geo-indexing: updates driver coordinates in Redis with geospatial indexes (`GEOADD`, `GEORADIUS`).
**Deps:** T-1001  
**Files Likely Affected:**
- `apps/api/src/modules/delivery/driver-status.ts`
- `packages/validation/src/delivery.ts`
**AC:**
1. Only authenticated drivers with valid assigned shift can toggle duty status.
2. Inactive drivers (no ping for > 15 minutes) automatically set to `OFFLINE`.

---

## T-1003 Smart Auto-Dispatch & Manager Fleet Assignment

**Objective:** Delivery dispatch system with both automated assignment (assigns to closest available rider with fewer than 2 active orders) and manual manager drag-and-drop override.  
**Revenue Impact:** Cuts delivery turnaround time by 12-18 minutes, guaranteeing hot food arrival and higher customer repeat rates.  
**Scope:**
- Dispatch algorithm: factors in estimated food ready time and driver distance.
- Dispatches event `delivery.assigned` via WebSocket and Push Notification to target driver's device.
- Auto-batching: groups multiple orders heading to the same apartment complex or neighborhood into a single trip.
**Deps:** T-1002, T-0010  
**Files Likely Affected:**
- `apps/api/src/modules/delivery/dispatcher.ts`
- `apps/api/src/modules/delivery/assignment.ts`
**AC:**
1. Cannot assign an order from Branch A to a driver locked to Branch B without manager override.
2. Driver assignment triggers instant push alert with pickup navigation address.

---

## T-1004 Secure Pickup & Customer Proof-of-Delivery OTP

**Objective:** Fraud-proof two-factor delivery verification: driver scans QR at kitchen counter to confirm package pickup, and customer provides a 4-digit secret OTP upon doorstep arrival.  
**Revenue Impact:** Completely eliminates false "order never received" claims and driver theft of meals.  
**Scope:**
- Secret OTP generated upon order dispatch, stored securely as a bcrypt/argon2 hash.
- OTP delivered to customer via SMS / WhatsApp message and on live tracking web page.
- Driver enters OTP in driver app; backend verifies hash without exposing raw OTP in API GET responses.
**Deps:** T-1003  
**Files Likely Affected:**
- `apps/api/src/modules/delivery/verification.ts`
**AC:**
1. Raw OTP is never exposed in any public or driver API response payloads.
2. Order cannot transition to `DELIVERED` status without correct OTP validation.
3. Max 3 failed OTP attempts locks delivery and prompts driver to call manager.

---

## T-1005 Cash-on-Delivery (COD) Reconciliation & Cash Drawer Closeout

**Objective:** Robust cash handling for COD orders: logs cash collected by each driver, tracks discrepancy vs. expected amount, and facilitates end-of-shift driver cash drop-off into manager till.  
**Revenue Impact:** Stops driver cash leakage and ensures 100% of cash collected on the road is safely deposited into the restaurant bank account.  
**Scope:**
- Driver COD ledger: `expected_amount_minor`, `collected_amount_minor`, `change_returned_minor`.
- End-of-shift reconciliation: manager counts cash handed over by rider and clicks "Settle Driver Shift".
- Posts balancing journal entry into payments and till transactions.
**Deps:** T-1004, T-0607  
**Files Likely Affected:**
- `packages/database/src/schema/delivery.ts`
- `apps/api/src/modules/delivery/cod-reconciliation.ts`
**AC:**
1. Zero float errors; strictly minor integer currency values.
2. Shift cannot be closed if driver has unverified open COD deliveries.

---

## T-1006 Lightweight Driver Mobile PWA (Progressive Web App)

**Objective:** Installable mobile PWA for delivery riders with offline task caching, high-contrast day/night mode, one-tap phone dialer, navigation deeplinking, and OTP entry.  
**Revenue Impact:** Zero app store distribution friction: drivers can install the PWA instantly via QR code on their own smartphones without needing expensive company-issued hardware.  
**Scope:**
- Built with Next.js PWA, Service Worker, and web push notifications.
- Views: Active Trips list, Delivery Details (items, special delivery notes, gate codes), Map navigation button, Collect Payment / Enter OTP modal.
**Deps:** T-0307, T-1004  
**Files Likely Affected:**
- `apps/web/app/driver/page.tsx`
- `apps/web/app/driver/[id]/page.tsx`
**AC:**
1. Tenant isolation: driver strictly sees only deliveries assigned to their own user account.
2. Offline resilient: cached trip details remain readable even when driving through cellular dead zones.

---

## T-1007 Driver Earnings, Distance Incentives & Commission Tracking

**Objective:** Performance and payout engine: tracks completed trips, distance travelled, on-time delivery rate, base trip pay, and customer tips.  
**Revenue Impact:** Transparent driver incentives reduce rider turnover, ensuring steady delivery fleet capacity during torrential rain or holiday surges.  
**Scope:**
- Configurable payout rules: fixed fee per delivery + per-kilometer distance allowance + 100% of customer tips.
- Driver daily/weekly earnings dashboard view.
**Deps:** T-1005  
**Files Likely Affected:**
- `apps/api/src/modules/delivery/earnings.ts`
- `apps/web/app/driver/earnings/page.tsx`
**AC:**
1. Aggregates daily delivery counts, distance pay, and gratuities accurately.
2. Payout report exportable to CSV/Excel for payroll processing.

---

## T-1008 Live Customer Order Tracking & Deep-Link Navigation

**Objective:** Real-time customer delivery tracking web page with live driver location on a map, estimated arrival time (ETA), and one-click turn-by-turn navigation for drivers (Google Maps / Apple Maps / Waze).  
**Revenue Impact:** Enhances brand prestige and customer trust, turning first-time delivery diners into loyal repeat direct customers.  
**Scope:**
- Lightweight customer tracking URL (`/track/:orderToken`) sent via SMS/WhatsApp.
- Maps adapter: works with Mapbox or Google Maps with zero-cost fallback to native deep-links (`geo:` URI scheme, Google Maps URL).
- Driver privacy protection: customer sees vehicle marker and ETA without seeing driver's personal phone number (masked call relay).
**Deps:** T-1006  
**Files Likely Affected:**
- `apps/web/app/track/[token]/page.tsx`
- `packages/maps/src/navigation-adapter.ts`
**AC:**
1. Live vehicle position updates via WebSocket or 5-second polling.
2. Driver phone number is never exposed in raw HTML or API payloads to the end customer.

---

## T-1009 Table Reservation Manager (TRM) & Digital Waitlist Queue

**Objective:** Centralized table booking and guest queue management: accepts online bookings (via branded website link, phone, or Reserve with Google), manages diner waitlists with automated SMS/WhatsApp alerts ("Your table for 4 is ready!"), and reduces no-shows via optional booking deposits.  
**Industry Benchmark (Petpooja TRM & Toast Tables):** Merges walk-in waitlist with advance table reservations on a single timeline view with estimated wait-time calculations based on active POS dining timers.  
**Scope:**
- `table_reservations`: `id`, `branch_id`, `customer_id`, `guest_name`, `guest_phone`, `party_size`, `reservation_time`, `table_id` (optional until seated), `status` (`CONFIRMED`, `WAITLISTED`, `SEATED`, `CANCELLED`, `NO_SHOW`), `special_requests`, `deposit_amount_minor`.
- Automated SMS/WhatsApp notification fired when table is assigned.
- Waitlist auto-calculation: predicts wait time based on average table dwell time (e.g. 45 mins).
**Deps:** T-0404, T-0611, T-1203  
**Files Likely Affected:**
- `packages/database/src/schema/restaurants.ts`
- `apps/api/src/modules/reservations/reservations.ts`
- `apps/web/app/dashboard/reservations/page.tsx`
**AC:**
1. Seating a reservation directly links and initializes the dining table on the POS floor plan.
2. Two-way WhatsApp response: guest can click "On my way" or "Cancel booking".

