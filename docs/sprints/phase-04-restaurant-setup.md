# Phase 4 — Restaurant Multi-Outlet Architecture, Table Management & Cash Drawer Configuration

Inspired by industry leaders like **Petpooja** and **Toast POS**, Phase 4 equips restaurants with enterprise-grade multi-outlet branch hierarchies, flexible floor sections, visual table layouts, role-based staff provisioning, and cash drawer / register float configurations.

---

## T-0401 Branch Master Configuration, Fiscal Tax IDs & Operating Policies

**Objective:** Configure complete branch operational profile: legal business entity, tax registration IDs (GSTIN / VAT / Sales Tax), timezone, multi-currency support, operational shifts, service charge rates, rounding rules, and anti-leakage audit settings.  
**Industry Benchmark (Petpooja Outlet Settings):** Single-click branch copy & centralized multi-outlet policy inheritance.  
**Scope:**
- `branch_settings`: `branch_id`, `legal_business_name`, `tax_id` (GSTIN/VAT), `fssai_license_number`, `timezone`, `currency`, `tax_inclusive_pricing` (boolean), `service_charge_percent_basis_points`, `rounding_strategy` (`NEAREST_ONE`, `NEAREST_FIFTY_CENTS`, `NONE`), `auto_kot_print` (boolean), `anti_void_protection_pin_required` (boolean).
- Operating hours array per day of the week with split-shift support (e.g. Lunch 12 PM - 3:30 PM, Dinner 7 PM - 11 PM).
**Deps:** T-0204  
**Files Likely Affected:**
- `packages/database/src/schema/restaurants.ts`
- `packages/validation/src/restaurants.ts`
- `apps/api/src/modules/restaurants/branch-settings.ts`
**AC:**
1. Rates stored strictly in basis points (e.g. 500 = 5.00% service charge).
2. Timezone validation uses strict IANA timezone identifiers (e.g. `Asia/Kolkata`, `America/New_York`).

---

## T-0402 Restaurant Profile, Brand Assets & Invoice Customizer

**Objective:** Restaurant branding master: logos, brand colors, receipt header & footer text, social media handles, Wi-Fi password for guests, and legal disclaimers.  
**Industry Benchmark (Toast & Petpooja Bill Customizer):** Configurable thermal and e-bill layout with custom logo, promotional discount coupons at bill bottom, and tax breakdowns.  
**Scope:**
- Media storage: S3/MinIO presigned URLs for logos and banner images.
- Bill template configuration: header greetings, footer disclaimers, FSSAI/Tax license display toggle, customer Wi-Fi details.
**Deps:** T-0401, T-0303  
**Files Likely Affected:**
- `packages/database/src/schema/restaurants.ts`
- `apps/api/src/modules/restaurants/profile.ts`
**AC:**
1. Restricted to `restaurant.manage` and `settings.manage` permissions.
2. Preview API endpoint generates sample thermal 80mm and 58mm preview strings.

---

## T-0403 Multi-Outlet Chain Management & Central Hub UI

**Objective:** Management dashboard for single outlets or multi-chain restaurant franchises: create branches, toggle branch operational status, manage opening hours, and compare cross-branch health.  
**Industry Benchmark (Petpooja Central Kitchen / Multi-Store):** Allows franchise owners to toggle an entire branch online or offline with one click.  
**Scope:**
- Branch switcher dropdown with active context persisted in local storage and session claims.
- Bulk branch actions: replicate menu or price catalog across multiple branches.
**Deps:** T-0204, T-0306  
**Files Likely Affected:**
- `apps/web/app/dashboard/branches/page.tsx`
- `packages/ui/src/components/branch-selector.tsx`
**AC:**
1. Seamless branch switching updates TanStack Query context without full browser reloads.
2. Graceful empty states for newly registered tenants with zero branches.

---

## T-0404 Dining Sections, Floor Layout & Smart Table Master Schema

**Objective:** Database schema modeling dining sections (Main Dining, AC Hall, Rooftop, Patio, Private Dining Room, Bar, Takeaway Counter) and dining tables with seating capacity, shapes, and QR ordering tokens.  
**Industry Benchmark (Toast Tables & Petpooja Table Layout):** Dynamic seating layout with visual shapes (Circle, Square, Rectangle) and unique static QR code payloads for contactless table-side ordering.  
**Scope:**
- `dining_sections`: `id`, `branch_id`, `name`, `service_charge_exempt` (e.g. Bar might have different surcharge than VIP room), `display_order`.
- `dining_tables`: `id`, `section_id`, `branch_id`, `table_number` (e.g., "T-01", "Bar-4"), `seating_capacity`, `shape` (`ROUND`, `SQUARE`, `RECTANGLE`), `pos_x`, `pos_y`, `qr_secret_token` (for customer scan & order), `is_active`.
**Deps:** T-0204  
**Files Likely Affected:**
- `packages/database/src/schema/restaurants.ts`
- `apps/api/src/modules/restaurants/tables.ts`
**AC:**
1. Unique table number per branch constraint enforced at database level.
2. Generates unique secure QR token for contactless mobile ordering.

---

## T-0405 Interactive Floor Plan Builder & Visual Table Editor UI

**Objective:** Drag-and-drop 2D floor plan editor for restaurant managers to visually map their actual dining room layout.  
**Industry Benchmark (Toast Visual Floor Plan):** Grid-snapping table editor with capacity indicators and section tabs.  
**Scope:**
- Interactive canvas using HTML5 Drag & Drop or SVG/Canvas.
- Table properties: edit table number, minimum/maximum covers (seats), and assign default waiter station.
**Deps:** T-0404, T-0302  
**Files Likely Affected:**
- `apps/web/app/dashboard/floor-plan/page.tsx`
- `packages/ui/src/components/floor-plan-editor.tsx`
**AC:**
1. Coordinates (`pos_x`, `pos_y`) persist automatically upon table drag release.
2. Mobile and tablet touch-friendly for floor managers configuring layout directly on iPads/Android tablets.

---

## T-0406 Staff Management, Role RBAC & Quick 4-Digit POS Passcode

**Objective:** Comprehensive staff directory: invite by email, assign to specific branches, designate roles (Owner, Manager, Cashier, Waiter, Chef, Driver), and assign unique 4-digit quick PIN codes for fast POS terminal login.  
**Industry Benchmark (Petpooja & Toast Fast Staff Switch):** Waiters and cashiers switch terminal screens in < 1 second using a 4-digit numeric PIN without typing lengthy email/passwords.  
**Scope:**
- `staff_profiles`: `id`, `user_id`, `branch_id`, `role`, `pos_pin_hash` (bcrypt/argon2 hashed 4-digit PIN), `is_active`.
- `POST /api/staff/pin-login`: rapid terminal authentication returning short-lived cashier session token.
**Deps:** T-0205, T-0105  
**Files Likely Affected:**
- `packages/database/src/schema/memberships.ts`
- `apps/api/src/modules/staff/pin-auth.ts`
**AC:**
1. POS PINs stored as secure cryptographic hashes; never in plaintext.
2. Unique PIN per branch enforced to prevent staff identity confusion during cashier shift changes.

---

## T-0407 Staff Management UI & Shift Scheduling Grid

**Objective:** Staff roster administration: invite staff, modify permissions, toggle active status, reset PINs, and define weekly shift rosters (Morning, Evening, Night).  
**Revenue Impact:** Streamlines labor scheduling and cuts down unauthorized overtime costs.  
**Scope:**
- User-friendly table with role badges, assigned branch tags, and quick-action menu (Reset PIN, Deactivate, Change Role).
- Audit log tracking whenever staff permissions or roles are mutated.
**Deps:** T-0406, T-0306  
**Files Likely Affected:**
- `apps/web/app/dashboard/staff/page.tsx`
- `packages/ui/src/components/staff-table.tsx`
**AC:**
1. Role modifications restricted strictly to Owner / General Manager.
2. Cannot remove the sole remaining Owner from an organization.

---

## T-0408 Cash Drawer Opening Float & Shift Session Lock Configuration

**Objective:** Configure mandatory cashier cash drawer shift tracking: setting opening cash float amount, idle screen timeout auto-lock, and drawer kick pulse triggers.  
**Industry Benchmark (Petpooja Cash Drawer & Shift Handover):** Requires cashier to declare starting cash in drawer before taking the first bill of the shift.  
**Scope:**
- `pos_registers`: `id`, `branch_id`, `name` (e.g. "Main Cashier Register", "Bar Terminal"), `idle_timeout_minutes` (default 5 mins), `require_drawer_float_declaration` (boolean).
- Peripheral trigger: ESC/POS kick drawer pulse byte sequence configuration (`ESC p m t1 t2`).
**Deps:** T-0401  
**Files Likely Affected:**
- `packages/database/src/schema/restaurants.ts`
- `apps/api/src/modules/restaurants/registers.ts`
**AC:**
1. Configured idle timeout enforces automatic POS screen lock to PIN-entry screen.
2. Shift opening float balance is persisted and passed directly into the Shift Day-End reconciliation module (Phase 6 / Phase 11).
