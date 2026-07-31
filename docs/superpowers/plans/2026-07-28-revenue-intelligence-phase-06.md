# Revenue Intelligence Phase 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a platform-only Revenue Intelligence Workbench under `/insightbooks/intelligence/revenue` with reconstruct-then-snapshot MRR, billing/collections analytics, matrix-gated metrics, and no false zeroes.

**Architecture:** Wave 0 readiness matrix first. Then `lib/admin/revenue/*` services write/read Phase 4 snapshot metricKeys (and reconstruct history), expose `/api/admin/intelligence/revenue/*`, and render section UI with Phase 5 metric envelopes. CORE + MRA EIS product split; per-currency + FX gate.

**Tech Stack:** Next.js App Router, Prisma, Vitest, existing Admin shell / `metricStates` / `saasBillingKpis` / analytics pipeline, en/ny locales.

**Spec:** [docs/superpowers/specs/2026-07-28-revenue-intelligence-phase-06-design.md](../specs/2026-07-28-revenue-intelligence-phase-06-design.md)

## Global Constraints

- Platform billing is the commercial source of truth; never combine with tenant GL/Sale.
- Billed, collected, contracted (estimated MRR), outstanding, credits/refunds stay distinct.
- No false zeroes; UNAVAILABLE when reconstruct/FX/source fails.
- No client-side authoritative calculations; no silent multi-currency consolidation.
- No accounting/billing/MRA EIS fiscal workflow changes.
- Do not implement metrics the readiness matrix marks UNAVAILABLE/DEFER as live numbers.
- Commits only when the user explicitly asks.

---

### Task 0: Wave 0 — Handoff + readiness audit pack

**Files:**
- Create: `docs/admin-intelligence-crm/phase-05/PHASE_06_INPUTS.md`
- Create: `docs/admin-intelligence-crm/phase-05/PHASE_06_READINESS_CHECKLIST.md`
- Create: `docs/admin-intelligence-crm/phase-05/FINAL_READINESS_DECISION.md`
- Create: `docs/admin-intelligence-crm/phase-06/README.md`
- Create: `docs/admin-intelligence-crm/phase-06/PHASE_06_SCOPE.md`
- Create: `docs/admin-intelligence-crm/phase-06/PHASE_INPUT_VALIDATION.md`
- Create: `docs/admin-intelligence-crm/phase-06/REVENUE_METRIC_READINESS_MATRIX.md`
- Create: `docs/admin-intelligence-crm/phase-06/PLATFORM_REVENUE_SOURCE_MAP.md`
- Create: `docs/admin-intelligence-crm/phase-06/MRR_BRIDGE_METHODOLOGY.md`
- Create: `docs/admin-intelligence-crm/phase-06/CURRENCY_AND_FX_POLICY.md`
- Create: `docs/admin-intelligence-crm/phase-06/PRODUCT_SPLIT_CORE_EIS.md`
- Create: `docs/admin-intelligence-crm/phase-06/PHASE_06_GAP_REGISTER.md`
- Create: `docs/admin-intelligence-crm/phase-06/IMPLEMENTATION_PLAN.md`

**Interfaces:**
- Produces: matrix classes `READY | READY_WITH_LIMITATIONS | READY_WITH_RECONCILIATION | UNAVAILABLE | NOT_SUPPORTED | DEFER` used by Wave 1 catalogue
- Produces: readiness decision `CONDITIONAL_GO` or `NO_GO` for Wave 1 code

- [ ] **Step 1:** Write Phase 5 handoff stubs listing concrete inputs (`saasBillingKpis`, analytics facts/snapshots, Platform* models, executive pack).
- [ ] **Step 2:** Write Phase 6 audit docs including full metric matrix for MRR bridge, billing, collections, ageing, cohorts, forecast, FX, industry/region.
- [ ] **Step 3:** Record FINAL readiness: **CONDITIONAL GO** if point-in-time MRR + PlatformPayment path exist; bridge/cohorts gated by reconstruct confidence.
- [ ] **Step 4:** Point `IMPLEMENTATION_PLAN.md` at this superpowers plan.
- [ ] **Step 5:** Stop for review before Wave 1 code (unless user says continue).

---

### Task 1: Wave 1 — Catalogue + permissions + reconstruct + snapshots + pack APIs

**Files:**
- Create: `lib/admin/revenue/metricCatalogue.js`
- Create: `lib/admin/revenue/reconstructMrr.js`
- Create: `lib/admin/revenue/mrrSnapshots.js`
- Create: `lib/admin/revenue/mrrBridge.js`
- Create: `lib/admin/revenue/revenueKpiPack.js`
- Create: `lib/admin/revenue/index.js`
- Modify: `lib/admin/permissions.js` — add `intel.revenueRead`, nav map for `/insightbooks/intelligence/revenue`
- Create: `app/api/admin/intelligence/revenue/overview/route.js`
- Create: `app/api/admin/intelligence/revenue/recurring/route.js`
- Create: `app/api/admin/intelligence/revenue/reconciliation/route.js`
- Create: `test/systemAdmin.revenueKpiPack.test.js`
- Create: `test/systemAdmin.reconstructMrr.test.js`

**Interfaces:**
- Consumes: `computeSaasBillingKpis(prisma, { periodStart })`, `metricEnvelope`, `authorizeAdminDecision`, `AnalyticsDailySnapshot` / `AnalyticsMonthlySnapshot`
- Produces:
  - `REVENUE_KPI_CODES` / `REVENUE_CATALOGUE_VERSION`
  - `reconstructMrrHistory(prisma, { from, to, currency }) → { days[], confidence, gaps[] }`
  - `persistMrrSnapshots(prisma, reconstructResult) → { written, skipped }`
  - `buildMrrBridge(prisma, { periodStart, periodEnd, currency }) → envelopes`
  - `buildRevenueKpiPack(prisma, { admin, periodStart, periodEnd, currency }) → { ok, forbidden?, metrics, attention, catalogueVersion }`

Snapshot metricKeys (document in methodology):

- `mrr_estimated_total_<CCY>`
- `mrr_estimated_core_<CCY>`
- `mrr_estimated_mra_eis_<CCY>`

- [ ] **Step 1:** Write failing tests for false-zero, CORE/EIS split, gap → UNAVAILABLE bridge, no Sale in pack JSON.
- [ ] **Step 2:** Implement catalogue from Wave 0 matrix (codes + definitions + class).
- [ ] **Step 3:** Implement reconstruct (active paid rows as-of date via `startedAt`/`expiresAt`/`status` best-effort; mark low-confidence days).
- [ ] **Step 4:** Implement snapshot persist/read helpers.
- [ ] **Step 5:** Implement bridge from adjacent snapshot days; missing open/close → UNAVAILABLE.
- [ ] **Step 6:** Implement `buildRevenueKpiPack` + overview/recurring/recon routes with `intel.revenue.read` OR finance/dashboard grants as designed.
- [ ] **Step 7:** Run:

```bash
npx vitest run test/systemAdmin.revenueKpiPack.test.js test/systemAdmin.reconstructMrr.test.js
```

Expected: PASS

---

### Task 2: Wave 2 — Revenue workbench shell + recurring UI

**Files:**
- Create: `lib/admin/revenueNav.js`
- Create: `components/admin/revenue/RevenueSectionNav.jsx`
- Create: `components/admin/revenue/RevenueKpiView.jsx` (reuse `MetricCard`)
- Create: `app/insightbooks/intelligence/revenue/page.js` (redirect → overview)
- Create: `app/insightbooks/intelligence/revenue/overview/page.js`
- Create: `app/insightbooks/intelligence/revenue/recurring/page.js`
- Create: `app/insightbooks/intelligence/revenue/mrr/page.js`
- Create: `app/insightbooks/intelligence/revenue/arr/page.js`
- Create: `app/insightbooks/intelligence/revenue/movements/page.js`
- Modify: `lib/admin/adminNav.js` — Intelligence → Revenue child or sibling link
- Modify: `locales/en|ny/admin-shell.json`, `admin-pages.json`

- [ ] **Step 1:** Add nav + `NAV_PERMISSION_MAP` for `/insightbooks/intelligence/revenue`.
- [ ] **Step 2:** Build section nav for all Phase 6 routes (unimplemented sections show UNAVAILABLE empty with matrix reason).
- [ ] **Step 3:** Wire overview/recurring/mrr/arr/movements to revenue APIs only.
- [ ] **Step 4:** en/ny strings; verify Super Admin can load overview.

---

### Task 3: Wave 3 — Billing, collections, ageing, payments, credits, MRA EIS

**Files:**
- Create: `lib/admin/revenue/billingAnalytics.js`
- Create: `lib/admin/revenue/collectionsAnalytics.js`
- Create: `lib/admin/revenue/receivablesAgeing.js`
- Create: `lib/admin/revenue/paymentPerformance.js`
- Create: `lib/admin/revenue/creditsRefundsAnalytics.js`
- Create: APIs under `app/api/admin/intelligence/revenue/{billing,collections,receivables,payment-performance,credits-refunds,mra-eis}/`
- Create: matching `app/insightbooks/intelligence/revenue/*/page.js`
- Create: `test/systemAdmin.revenueBilling.test.js`

**Interfaces:**
- Produces ageing buckets `{ current, d1_30, d31_60, d61_90, d90_plus }` per currency from `PlatformInvoice`
- Payment success/failure rates from `PlatformPayment.status` (never invent retries if retry model absent → UNAVAILABLE)

- [ ] **Step 1:** Tests for ageing sum = outstanding total; multi-currency separation.
- [ ] **Step 2:** Implement analytics modules + APIs + pages.
- [ ] **Step 3:** Run billing tests; manual check collections page.

---

### Task 4: Wave 4 — Cohorts, concentration, forecast, recon UI, reports, close

**Files:**
- Create: `lib/admin/revenue/cohorts.js`
- Create: `lib/admin/revenue/concentration.js`
- Create: `lib/admin/revenue/forecast.js` (deterministic renewal exposure from `expiresAt` + active MRR only)
- Create: APIs + pages for cohorts, retention, customers, segments, concentration, forecast, reconciliation, reports, definitions, settings
- Modify: Phase 5 executive attention/soft-link to revenue drill-downs
- Create: `app/api/admin/intelligence/revenue/export/route.js`
- Create: `docs/admin-intelligence-crm/phase-06/FINAL_PHASE_06_REPORT.md`
- Create: `test/systemAdmin.revenueForecast.test.js`

- [ ] **Step 1:** Cohorts only when reconstruct confidence covers cohort window; else UNAVAILABLE.
- [ ] **Step 2:** Forecast = sum of contracted MRR with renewals in horizon; scenarios = simple multipliers documented in definitions (no ML).
- [ ] **Step 3:** Export CSV/JSON (+ XLSX/PDF if export helpers already exist; else JSON/CSV foundation + UNAVAILABLE for missing formats).
- [ ] **Step 4:** Final report + regression:

```bash
npx vitest run test/systemAdmin.revenue*.test.js test/systemAdmin.executiveKpiPack.test.js test/systemAdmin.navPermissionMap.test.js
```

Expected: PASS; CoA still unmapped; no Sale in revenue pack.

---

## Plan self-review

| Spec section | Task |
|--------------|------|
| Wave 0 docs | Task 0 |
| Reconstruct-then-snapshot | Task 1 |
| Bridge / catalogue / APIs | Task 1 |
| Workbench routes (core recurring) | Task 2 |
| Billing/collections/ageing | Task 3 |
| Cohorts/forecast/recon/reports | Task 4 |
| FX gate / product split | Tasks 0–1 (policy + pack) |
| Non-goals | Enforced by matrix + tests |

No TBD placeholders. Commit steps omitted unless user requests commits.
