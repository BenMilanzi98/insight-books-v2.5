# Controlled Rollout

Posting mode is resolved server-side per business/module/event from
`AcctV2FeatureFlag` scopes (`infrastructure/featureFlags.js`). The global
default is `LEGACY`. **No production-wide activation happened in Phase 4.**

## Stages

| Stage | Scope | State |
| --- | --- | --- |
| 1 | Development — synthetic events, unit + integration tests | **Done** (Phase 4 test suite) |
| 2 | Staging — production-like data, manual journals, shadow comparisons | Ready to execute |
| 3 | Approved pilot business — manual journals in `NEW_ENGINE`, operational events in `SHADOW` | Requires flag grant + finance approval |
| 4 | Approved low-risk event in `NEW_ENGINE`; legacy disabled for that event (automatic via legacy guard) | Requires Stage 3 acceptance |
| 5 | Module-by-module integration | **Phase 9** |

## Pre-activation checklist (per business + event)

1. CoA readiness assessment is `READY` (Phase 3 API).
2. All template-required mappings exist and are unambiguous.
3. Period resolver returns a valid open period for current dates.
4. Full test suite green; duplicate-prevention tests pass.
5. Shadow exact-match rate meets threshold (≥ 98%) for the event.
6. Finance team sign-off recorded.
7. Rollback rehearsed (flip flag back to LEGACY, verify legacy path resumes).

## Activation mechanics

Grant the `NEW_ENGINE` flag scope for `(business, module, eventType)` through
the audited flag API (`accountingPosting.manageModes`, reason required). The
legacy guard then automatically refuses legacy postings for that scope —
activation and legacy-disablement are one atomic decision, not two separate
configurations that can drift.

`DISABLED` mode is available per scope for emergency containment (both engines
refuse).
