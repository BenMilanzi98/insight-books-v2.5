# Final Gap Register

**Date:** 2026-07-28  
**Program:** MRA EIS Payment Plans

## P0 — Blockers before any commercial EIS self-serve

| ID | Gap | Classification |
|----|-----|----------------|
| G-01 | No migrations/FKs guarantee for Platform* tables | INCOMPLETE |
| G-02 | PayChangu trusts client amount | UNSAFE |
| G-03 | Core+EIS coexistence broken by deactivate-all | DUPLICATE_SUBSCRIPTION_RISK |
| G-04 | Subscription ↔ entitlement not wired | ENTITLEMENT_RISK / DISCONNECTED |
| G-05 | Public EIS pricing missing; prices hardcoded for core | INCOMPLETE |
| G-06 | Capability futureRuntime stub | INCOMPLETE |
| G-07 | Legacy eisEnabled/eisService bypass | UNSAFE / ENTITLEMENT_RISK |

## P1 — Domain completeness

| ID | Gap |
|----|-----|
| G-08 | planCategory / features / limits / public flags on PlatformPlanVersion (or dedicated aggregate) |
| G-09 | Plan state machine (DRAFT→PUBLISHED→…) with approval |
| G-10 | Canonical pricing service |
| G-11 | MRA EIS subscription state machine + scope uniqueness |
| G-12 | Checkout idempotency end-to-end |
| G-13 | Invoice/payment write from PayChangu into Platform* |
| G-14 | Trials for EIS |
| G-15 | Upgrade/downgrade/proration/cycle change |
| G-16 | Usage metering + overage (retry-safe) |
| G-17 | Discounts/coupons |
| G-18 | Admin MRA EIS Plans wizard + nav |
| G-19 | Tenant subscription management surface for EIS |
| G-20 | Reconciliation centre for EIS commercial loop |

## P2 — Hardening & ops

| ID | Gap |
|----|-----|
| G-21 | Permission namespace unification |
| G-22 | Segregation of duties |
| G-23 | Reports / imports / exports |
| G-24 | Dual-language public copy |
| G-25 | Full a11y + responsive test matrix |
| G-26 | Admin eis-subscriptions UI flag + permission harden |

## Decisions

| Decision | Choice | Date |
|----------|--------|------|
| Plan modeling | **A — EXTEND `PlatformPlanVersion`** with `planCategory=MRA_EIS` + features/limits/public fields | 2026-07-28 |
| Entitlement policy | **A — Subscription first** — payment activates commercial sub; entitlement pending admin review before setup/transmit | 2026-07-28 |

Thin `MraEisSubscription` wrapper only if `AccountSubscription` cannot safely coexist with core plans (to be validated in Phase 1).
