# Phase 9 Residuals Closed (post–final review)

**Date:** 2026-07-29

After whole-phase review, remaining **Phase 9** polish items were closed. Intentional **Phase 10 blockers** (Android product usage, broad module producers, support/onboarding, FEATURE_USED fleet plane, XLSX/PDF export depth, deep retention/journeys) remain documented and are **not** Phase 9 work.

## Closed

| Item | Change |
|------|--------|
| Evaluate / adoption persist-by-default | `evaluateAdoptionState` and evaluate POST are **opt-in** (`persist === true` only) |
| Authz comment drift | `authz.js` header matches `canView` (productAnalytics.read \| product.read) |
| Wave 2 SQL not applied locally | Applied `scripts/sql/product-analytics-phase09-wave2.sql` to `insightbooksmw` |
| Vitest after polish | **53/53** product-analytics suites PASS |

## Still deferred (Phase 10 / later — not Phase 9)

- Broad module instrumentation beyond Invoice / POS / MRA accept  
- Android meaningful-action producers  
- Support / onboarding product analytics  
- Entitlement matching heuristic refinement  
- UI polish (MetricCard i18n strings, definitions browser)  
- XLSX/PDF scheduled exports  

## Exit unchanged

**READY_FOR_PHASE_10_WITH_BLOCKERS**
