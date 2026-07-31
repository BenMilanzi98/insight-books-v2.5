# Current Adoption ← Phase 9 Evidence Audit

**Audited:** 2026-07-31

| Module | Path | Class | Role for Adoption |
|--------|------|-------|-------------------|
| First value | `lib/admin/productAnalytics/firstValue.js` | CORRECT_AND_REUSABLE | Milestone / value evidence snapshots |
| Product adoption state | `lib/admin/productAnalytics/adoption.js` | CORRECT_AND_REUSABLE | Feature-state evidence — ≠ CS Adoption Plan |
| Signals | `lib/admin/productAnalytics/signals.js` | CORRECT_AND_REUSABLE | Dormancy queue (`VALUE_THEN_INACTIVE` etc.) |
| Repeat value | `repeatValue.js` | CORRECT_AND_REUSABLE | Value outcome support |
| Activation | `activation.js` | CORRECT_AND_REUSABLE | Feature activation evidence |
| Reliability gate | `reliabilityGate.js` | CORRECT_AND_REUSABLE | Gate fail → not false zero |
| Overview | `overview.js` | CORRECT_AND_REUSABLE | Honesty pattern for Wave 4 cards |
| Facts / producers | `facts.js`, `producers.js` | CORRECT_AND_REUSABLE | Upstream instrumentation — Adoption read-only |
| Reconcile | `reconcile.js` | CORRECT_AND_REUSABLE | Recon honesty patterns |
| Barrel | `index.js` | CORRECT_AND_REUSABLE | Public exports |
| UI adoption inspect | `app/insightbooks/intelligence/product-analytics/adoption/page.js` | CORRECT_AND_REUSABLE | Analytics home |
| Adoption evidence snapshot service | — | NOT_FOUND | Wave 2 `evidence.js` |
| Gate fail → milestone MET | FORBIDDEN | Must map to UNKNOWN / UNAVAILABLE |
| Missing instrumentation → invented zero KPI | FORBIDDEN | `value: null` + UNAVAILABLE |

**Implication:** Wave 2 wraps Phase 9 calls as dated evidence snapshots with `sourceSystem` + observedAt; never mutates product-analytics warehouse; never MET on gate fail.
