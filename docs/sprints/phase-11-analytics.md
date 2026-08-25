# Phase 11 — Analytics

## T-1101 Sales aggregates API

**Objective:** Today/week/month revenue, orders, AOV for branch/restaurant.  
**Deps:** T-0609  
**AC:** `reports.view`; tenant scoped; money bigint.

## T-1102 Item and category performance

**Objective:** Top items query from order_items snapshots.  
**Deps:** T-1101  
**AC:** Indexes used.

## T-1103 Payment breakdown

**Objective:** Sum by method.  
**Deps:** T-0607  
**AC:** Matches payments table.

## T-1104 Inventory and expense reports

**Objective:** Stock valuation estimate (document method) + expenses sum.  
**Deps:** T-0802, expenses table (add T-1104a if expenses module missing: schema+API expenses CRUD first).  
**AC:** If expenses absent, split: T-1104a expenses module, T-1104b report.

## T-1105 Owner dashboard UI

**Objective:** KPI cards, trend chart, top items, low stock.  
**Deps:** T-0306, T-1101, T-0806  
**AC:** Skeleton/empty/error.

## T-1106 Manager ops dashboard UI

**Objective:** Live counts, alerts—not full BI.  
**Deps:** T-1101, T-0702  
**AC:** Distinct layout from owner.
