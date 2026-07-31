# Phase 9 Final Report — Product Analytics

**Decision:** **READY_FOR_PHASE_10_WITH_BLOCKERS**

**Date:** 2026-07-29

Product Analytics workbench is shippable for authorised System Admin users on the **instrumented commerce trio** (Invoice post, POS complete, MRA EIS accept): catalogue, producers, usage facts, first-value / activation / adoption, funnels, first-value cohorts, deterministic signals, light recon, and JSON/CSV export foundation. Broad modules, Android product usage, support/onboarding, and FEATURE_USED remain explicitly gated — never false zeros.

## Delivered

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Audits + matrices + CONDITIONAL GO | Done |
| 1 | Catalogue + reliability gate + Invoice/POS/EIS producers | Done |
| 2 | First-value / activation / adoption engines | Done |
| 3 | Workbench UI + nav + i18n + overview honesty | Done |
| 4 | Funnels / cohorts / signals / recon / export + Phase 10 pack | Done |

## Surfaces (Wave 4)

### Libraries

- `lib/admin/productAnalytics/funnels.js` — versioned `commerce.invoice.value`, `commerce.pos.value`, `eis.operational`; step-order honesty; incomplete ≠ zero conversion
- `lib/admin/productAnalytics/cohorts.js` — first-value period cohorts; no zero-fill; association ≠ causation label
- `lib/admin/productAnalytics/signals.js` — deterministic product signals; idempotent identity; no probability/revenue
- `lib/admin/productAnalytics/reconcile.js` — catalogue ↔ events ↔ facts for commerce trio; failed recon blocks complete metrics
- `lib/admin/productAnalytics/export.js` — JSON/CSV foundation; `productAnalytics.export` + portfolio-aware

### APIs

- `GET /api/admin/intelligence/product-analytics/funnels`
- `GET /api/admin/intelligence/product-analytics/cohorts`
- `GET /api/admin/intelligence/product-analytics/signals`
- `GET /api/admin/intelligence/product-analytics/reconcile`
- `GET /api/admin/intelligence/product-analytics/export?dataset=&format=json|csv`

### UI

Live: funnels, cohorts, signals, reconciliation, reports (export pack). Definitions remain stub (catalogue version on overview).

## Hard rules preserved

- Page views / login alone ≠ value / activation / adoption
- Retries / reprints / rejects ≠ new EIS accept value
- Missing events → incomplete funnel / UNAVAILABLE — never invented 0 conversion
- Cohorts omit empty periods (no zero-fill)
- Association helpers labelled association, not causation
- Failed recon ≠ false complete / READY conversion
- No Tenant Sale; CoA admin route stays removed

## Known blockers for Phase 10

1. **Broad module instrumentation** — payroll and other catalogue shells stay `NOT_INSTRUMENTED` (P9-G02 partial)
2. **Android product usage** — version telemetry only; no meaningful-action producers (P9-G06)
3. **Support / onboarding / training** — still uninstrumented for product analytics (P9-G12)
4. **FEATURE_USED scaffold** — commerce uses typed event codes; generic FEATURE_USED not a live metric plane
5. **Unique-user DAU/WAU/MAU** — login proxies forbidden as product engagement
6. **Export** — foundation only (JSON/CSV, capped packs); XLSX/PDF not offered
7. **Retention / journey depth** — matrices exist; engines beyond first-value cohorts deferred
8. **Definition browser UI** — stub; versions surface on overview / packs

## Verification

```bash
npx vitest run test/systemAdmin.productAnalytics.wave4.test.js test/systemAdmin.productAnalyticsNav.test.js
```

Expected: PASS (funnel step order, signal dedupe, recon honesty, nav map).

## Post-review polish (same day)

- Adoption / evaluate persist is opt-in only (`persist === true`).
- Product Analytics authz header aligned with actual `canView` rules.
- Wave 2 SQL applied locally (`AnalyticsFactProductUsage`, `ProductFirstValueFact`, `ProductAdoptionStateHistory`).
- See `PHASE_09_RESIDUALS_CLOSED.md`.

## Exit readiness

**READY_FOR_PHASE_10_WITH_BLOCKERS** — commerce/EIS product analytics foundations are honest and gated; Android, broad modules, and support planes remain blockers for treating Product Analytics as fleet-complete.
