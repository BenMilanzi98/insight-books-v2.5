# Admin Dashboard Control Tower Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Ship a Recharts control-tower dashboard and expressive shared admin polish using existing APIs.

**Architecture:** Compose dashboard/stats, tenant-growth, platform-billing, system-health, users/stats, affiliate/stats on the client. Shared CSS motion + chart primitives under `components/admin`.

**Tech Stack:** Next.js client pages, Recharts, Lucide, existing admin tokens.

## Global Constraints

- Never invent metrics
- Respect `prefers-reduced-motion`
- No new aggregator API; no Framer Motion
- Keep calm slate ops visual system

---

### Task 1: Motion tokens + page enter

- [ ] Add admin motion CSS in `app/globals.css`
- [ ] Add `AdminPageEnter` / wire into `AdminPageContainer`
- [ ] Soft-lift styles for cards/tables/sidebar

### Task 2: Chart primitives

- [ ] `AdminChartCard`, `AdminPieChart`, `AdminTrendChart`, `AdminBarChart`
- [ ] Export from `components/admin/index.js`

### Task 3: Dashboard page

- [ ] Rebuild `app/insightbooks/dashboard/page.js` as control tower
- [ ] Independent panel failure; range toggle; empty states

### Task 4: Shared polish

- [ ] `AdminSummaryCard`, `AdminDataTable`, sidebar, header micro-interactions

### Task 5: Tests

- [ ] Extend Wave 1 UI tests for new exports + motion CSS + dashboard charts
