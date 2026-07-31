# Task P9-4 Report — Wave 4 Funnels/cohorts/signals/recon/export + Phase 10 pack

**Status:** DONE  
**Date:** 2026-07-29  
**Commits:** none — commit deferred  

## Summary

Implemented Product Analytics Wave 4 foundations for the instrumented commerce trio + EIS accept: versioned funnels (step-order / incomplete honesty), first-value cohorts (no zero-fill, association ≠ causation), deterministic product signals (idempotent identity, no probability/revenue), light catalogue↔events↔facts recon (failed recon blocks false-complete metrics), and permission/portfolio-aware JSON/CSV export. Wired Task 3 stub pages to live Wave 4 UI + APIs. Exit docs record **READY_FOR_PHASE_10_WITH_BLOCKERS**.

## Acceptance

| Check | Result |
|-------|--------|
| Funnel/signal/recon tests PASS | **PASS** — `test/systemAdmin.productAnalytics.wave4.test.js` |
| Phase 10 pack written | **PASS** — `FINAL_PHASE_09_REPORT.md`, `PHASE_10_INPUTS.md`, `PHASE_10_READINESS_CHECKLIST.md` |
| Final readiness WITH_BLOCKERS | **PASS** — `READY_FOR_PHASE_10_WITH_BLOCKERS` |
| Do not git commit | **Honoured** |

## TDD evidence

1. Wrote `test/systemAdmin.productAnalytics.wave4.test.js` (funnel step order, null conversion, cohort no zero-fill, signal dedupe, recon honesty, export perm gate).
2. Implemented `funnels` / `cohorts` / `signals` / `reconcile` / `export` + APIs + Wave4 UI.
3. Final run: **`npx vitest run test/systemAdmin.productAnalytics.wave4.test.js test/systemAdmin.productAnalyticsNav.test.js` → 15 passed (15)**.

## Files created

### Libs
- `lib/admin/productAnalytics/funnels.js`
- `lib/admin/productAnalytics/cohorts.js`
- `lib/admin/productAnalytics/signals.js`
- `lib/admin/productAnalytics/reconcile.js`
- `lib/admin/productAnalytics/export.js`

### APIs
- `app/api/admin/intelligence/product-analytics/funnels/route.js`
- `app/api/admin/intelligence/product-analytics/cohorts/route.js`
- `app/api/admin/intelligence/product-analytics/signals/route.js`
- `app/api/admin/intelligence/product-analytics/reconcile/route.js`
- `app/api/admin/intelligence/product-analytics/export/route.js`

### UI
- `components/admin/productAnalytics/ProductAnalyticsWave4View.jsx`

### Docs / test / report
- `docs/admin-intelligence-crm/phase-09/FINAL_PHASE_09_REPORT.md`
- `docs/admin-intelligence-crm/phase-09/PHASE_10_INPUTS.md`
- `docs/admin-intelligence-crm/phase-09/PHASE_10_READINESS_CHECKLIST.md`
- `test/systemAdmin.productAnalytics.wave4.test.js`
- `.superpowers/sdd/task-p9-4-report.md`

## Files modified

- `lib/admin/productAnalytics/index.js` — re-export Wave 4 modules
- `lib/admin/productAnalyticsNav.js` — funnels/cohorts/signals/recon/reports → live
- `components/admin/index.js` — export Wave4View
- Pages: `funnels|cohorts|signals|reconciliation|reports/page.js` → Wave4View
- `locales/en|ny/admin-pages.json` — Wave 4 hints + labels

## Honesty notes

- Funnels: missing events → `INCOMPLETE` / null conversion (never invented 0%).
- Cohorts: only periods with first-value anchors; February omitted when Jan+Mar exist.
- Signals: strip probability/revenue; identity `psig:tenant:code:feature`.
- Recon: events without facts → `FAIL` + `blockedByRecon` (complete false, conversion null).
- Export: requires `productAnalytics.export`; portfolio mode recorded.

## Blockers carried to Phase 10

Android product usage, broad modules, support/onboarding, FEATURE_USED live plane, XLSX/PDF export, retention/journey depth beyond first-value cohorts.

---

## Review fix-up (Important findings) — 2026-07-29

Addressed `task-p9-4-review.md` Important #1 and #2 (no git commit).

### Fixes
1. **Portfolio isolation** — `funnels.js` / `signals.js` / `export.js` reject out-of-portfolio `tenantId` with `tenant_out_of_portfolio` (owned/none modes), matching cohorts/recon. Overview counts (`overview.js`) apply owned-mode tenant filters so export/overview no longer leak fleet totals for portfolio agents.
2. **Reports nav ↔ export permission** — `NAV_PERMISSION_MAP` reports route + section `permission` require `productAnalytics.export`. `ProductAnalyticsSectionNav` gates Reports (CS-style) so read-only users do not get a live link that 403s.

### Tests
- Added portfolio isolation cases (funnels / signals / export) in `test/systemAdmin.productAnalytics.wave4.test.js`.
- Nav test asserts Reports → export permission; Wave 4 readiness live.
- Re-run: `npx vitest run test/systemAdmin.productAnalytics.wave4.test.js test/systemAdmin.productAnalyticsNav.test.js` → **19 passed (19)**.
