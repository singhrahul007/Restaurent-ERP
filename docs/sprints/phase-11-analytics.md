# Phase 11 — Analytics, Menu Engineering (BCG Matrix) & Financial BI

Raw sales numbers don't guarantee profitability. Phase 11 turns transactional data into strategic financial intelligence: Menu Engineering BCG Matrix (Stars, Plowhorses, Puzzles, Dogs), hourly rush heatmaps, food cost percentage (FCP) monitoring, table turn metrics, and executive profit-and-loss dashboards.

---

## T-1101 Fast OLAP Aggregations & Sales Metrics API

**Objective:** High-speed time-bucketed aggregation queries (Hourly, Daily, Weekly, Monthly, Year-to-Date) for Gross Sales, Net Sales, Tax Collected, Discounts, Tips, Average Order Value (AOV), and Guest Headcount.  
**Revenue Impact:** Equips owners with real-time financial clarity to identify peak revenue windows and optimize branch operations.  
**Scope:**
- Aggregates pre-computed or indexed queries over `orders` and `payments`.
- Metrics: Gross Sales, Net Sales, Void Losses, Discounts Applied, Taxes Collected, Service Charges, Refunds, Average Ticket Size, RevPASH (Revenue Per Available Seat Hour).
- Fast date-range filtering with branch comparison (e.g. Branch Downtown vs. Branch Uptown).
**Deps:** T-0609  
**Files Likely Affected:**
- `apps/api/src/modules/reports/sales.ts`
- `packages/validation/src/reports.ts`
**AC:**
1. Restricted to users with `reports.view` permission; strictly isolated by tenant organization.
2. Query execution benchmarks: returns 90-day multi-branch aggregated revenue in < 300ms using composite timestamp indexes.

---

## T-1102 Menu Engineering Matrix (BCG Stars, Plowhorses, Puzzles, Dogs)

**Objective:** Algorithmic categorization of all menu dishes based on Profit Margin vs. Sales Volume (Popularity):  
- **Stars (High Profit, High Popularity):** Protect quality, feature prominently on menu hero banners.  
- **Plowhorses (Low Profit, High Popularity):** High volume workhorses; subtly increase price or adjust recipe portioning to raise margin.  
- **Puzzles (High Profit, Low Popularity):** High margin gems; train cashiers to upsell and feature in promotional bundles.  
- **Dogs (Low Profit, Low Popularity):** Waste kitchen prep time; candidate for menu elimination.  
**Revenue Impact:** Direct 8% to 15% increase in bottom-line net profit simply by rebalancing dish pricing and menu layout.  
**Scope:**
- Calculates median sales volume and median gross margin per category.
- Classifies each active item into one of the 4 quadrants.
- Returns actionable recommendations (e.g. "Increase Burger price by \$1.50 to turn this Plowhorse into a Star").
**Deps:** T-1101, T-0503  
**Files Likely Affected:**
- `apps/api/src/modules/reports/menu-engineering.ts`
- `apps/web/app/dashboard/analytics/menu-engineering/page.tsx`
**AC:**
1. Categorization computed accurately based on actual historical sales volume and recipe cost snapshots.
2. Visual 2x2 scatter matrix plot rendered interactively in UI.

---

## T-1103 Payment Reconciliation & Channel Breakdown Report

**Objective:** Unified payment audit report breaking down captured funds by tender method (Cash, Card, UPI, Wallets, Gift Cards, Delivery Aggregators) against gateway fees and expected bank deposits.  
**Revenue Impact:** Prevents credit card settlement shortfalls, cash till discrepancies, and unexpected payment processor transaction chargebacks.  
**Scope:**
- Reconciliation view: compares Cash register opening float + collected cash - paid out expenses = expected closing cash.
- Flags till discrepancies exceeding defined tolerance (e.g. +/- \$5 cash shortage).
- Summarizes gross vs. net payout after gateway merchant discount rates (MDR).
**Deps:** T-0607  
**Files Likely Affected:**
- `apps/api/src/modules/reports/payments.ts`
- `apps/web/app/dashboard/reports/payments/page.tsx`
**AC:**
1. Sum of method totals reconciles 100% against total captured payments table.
2. Identifies un-deposited or in-transit digital settlement balances.

---

## T-1104 Food Cost Percentage (FCP) & Operational Expense Ledger

**Objective:** Real-time calculation of Food Cost Percentage (`Total Food Cost / Total Food Sales * 100`) combined with general operating expenses (Rent, Utilities, Staff Wages, Maintenance).  
**Revenue Impact:** Gives the owner an immediate early-warning alarm if food cost creeps above the safe threshold (typically 28-32%), stopping losses before month-end.  
**Scope:**
- `expenses`: `id`, `organization_id`, `branch_id`, `category` (`RAW_MATERIALS`, `LABOR`, `UTILITIES`, `RENT`, `MARKETING`, `REPAIRS`), `amount_minor`, `payment_method`, `receipt_url`, `notes`, `incurred_date`.
- Combined P&L summary: Revenue - Cost of Goods Sold (COGS) = Gross Profit; Gross Profit - Operating Expenses = Net Operating Income.
**Deps:** T-0802, T-1101  
**Files Likely Affected:**
- `packages/database/src/schema/expenses.ts`
- `apps/api/src/modules/expenses/expenses.ts`
- `apps/api/src/modules/reports/pnl.ts`
**AC:**
1. Displays live FCP gauge with target threshold benchmarks.
2. Expense tracking supports receipt image attachment upload and multi-category expense filtering.

---

## T-1105 Executive Multi-Branch Owner Dashboard UI

**Objective:** High-level executive dashboard presenting key performance indicators (KPIs), multi-branch leaderboard, sales trends, food cost gauges, and urgent operational alerts.  
**Revenue Impact:** Allows multi-unit restaurant operators to monitor all locations from their smartphone and spot underperforming branches in seconds.  
**Scope:**
- Key KPI cards: Today's Revenue, Order Volume, Average Table Turn Time, Food Cost %, Labor Cost %.
- Branch Comparison Leaderboard: compares Downtown vs. Suburbs on revenue, growth, and customer satisfaction score.
- Trend charts (TanStack / Recharts) with hour-by-hour comparison against same day last week.
**Deps:** T-0306, T-1101, T-0806  
**Files Likely Affected:**
- `apps/web/app/dashboard/page.tsx`
- `packages/ui/src/components/dashboard-kpi-cards.tsx`
- `packages/ui/src/components/revenue-chart.tsx`
**AC:**
1. Implements responsive skeleton loaders, empty states, and cached fast-refresh.
2. Real-time auto-refresh toggle for live shift monitoring.

---

## T-1106 Floor Manager Operations Dashboard & Rush Heatmaps

**Objective:** Real-time tactical dashboard for floor managers: live dining room table occupancy %, current open orders, average kitchen prep ticket times, and hourly customer rush heatmaps.  
**Revenue Impact:** Optimizes staff scheduling and table seating during lunch and dinner rushes to maximize table turns and prevent service meltdown.  
**Scope:**
- Live metrics: Active Tables, Tables in "Bill Requested" state, Kitchen Overdue Tickets (>15m), Available Delivery Drivers.
- Rush Heatmap: 24-hour x 7-day grid showing transaction density, guiding smart staff shift scheduling.
**Deps:** T-1101, T-0702  
**Files Likely Affected:**
- `apps/web/app/ops/page.tsx`
- `packages/ui/src/components/rush-heatmap.tsx`
**AC:**
1. Optimized for floor manager tablets with automatic 30-second live polling or WebSocket updates.
2. Urgent alerts (e.g., "Table 12 waiting for bill > 10 mins") flagged in high-priority visual banner.

---

## T-1107 Granular Business Report Catalog & AI Natural Language Query Tool

**Objective:** Enterprise reporting suite with comprehensive exportable reports (Day-End Z-Reports, Item-wise Sales, Tax Slabs, Server Commission, Discount/Void Audit, and Inventory Spoilage) plus an AI Query Assistant allowing owners to query sales data with natural language (e.g. "What was my highest selling dessert this Friday compared to last Friday?").  
**Industry Benchmark (Petpooja 94+ Reports Suite & AI Assistant):** Zero manual spreadsheet calculation; instant PDF/Excel exports, and instant chat-based revenue queries for busy owners on the go.  
**Scope:**
- Categorized Report Directory: Sales (Daily, Hourly, Category), Taxes (CGST, SGST, Cess, VAT), Staff Performance (Bills punched, Tips earned, Voids issued), Inventory (Depletion, Spoilage, PO Fulfillment).
- LLM / SQL Query Interface: safely translates natural language questions into read-only, tenant-isolated parameterized analytics queries.
**Deps:** T-1101, T-1103, T-1104  
**Files Likely Affected:**
- `apps/api/src/modules/reports/catalog.ts`
- `apps/api/src/modules/reports/ai-assistant.ts`
- `apps/web/app/dashboard/reports/page.tsx`
**AC:**
1. Exports to CSV, XLSX, and formatted printable PDF in < 2 seconds.
2. AI Query Assistant enforces read-only SQL role with mandatory `WHERE organization_id = ?` parameter binding.

