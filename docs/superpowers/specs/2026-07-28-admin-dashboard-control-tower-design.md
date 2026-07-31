# Admin Dashboard Control Tower — Design Spec

**Date:** 2026-07-28  
**Surface:** `/insightbooks/dashboard` + shared admin polish  
**Status:** Approved for implementation

## Locked decisions

| Decision | Choice |
|----------|--------|
| Scope | **A — Dashboard-first** + light shared polish across admin |
| Story | **C — Combined control tower** (tenant pie + revenue trend + health/ops) |
| Motion | **B — Expressive** (page enter, stagger, hover lifts, table reveals, shell micro-interactions) |
| Approach | **1 — Compose existing APIs** + Recharts; no new aggregator; no Framer Motion |

## Goals

1. Rebuild `/insightbooks/dashboard` as a dense, useful control tower with robust pie + trend + bar charts and crucial KPIs.
2. Apply light shared motion/visual polish across `/insightbooks` via primitives (not per-page redesigns).
3. Never invent metrics — missing data shows empty/unavailable states.

## Non-goals

- New aggregator API
- Framer Motion / Chart.js migration
- Tenant-app redesign
- Full rewrite of every admin page’s content

## Dashboard layout

1. Header (title, last refreshed, Refresh)
2. KPI strip (6): Tenants, Users, Active subscriptions, MRR / payments this period, Open invoices, Affiliates
3. Health/ops strip: status, queue failures, memory/uptime when available
4. Charts: pie (tenant/subscription mix) + area/line (platform payments by range 7d/30d/90d)
5. Secondary: bar (user growth or tenant growth) + recent activity
6. Quick navigation tiles

## Data sources (compose)

- `/api/admin/dashboard/stats`
- `/api/admin/dashboard/tenant-growth`
- `/api/admin/platform-billing/overview`
- `/api/admin/platform-billing/payments` (client-bucketed for trend)
- `/api/admin/system-health`
- `/api/admin/users/stats`
- `/api/admin/affiliate/stats`

## Shared polish

- CSS motion under `--admin-*` + `prefers-reduced-motion`
- `AdminPageEnter` via `AdminPageContainer`
- Chart kit: `AdminChartCard`, `AdminPieChart`, `AdminTrendChart`, `AdminBarChart`
- Enhance `AdminSummaryCard`, `AdminDataTable`, sidebar, header

## Testing

File-content / export smoke tests in `test/systemAdmin.uiWave1.test.js` (or sibling).
