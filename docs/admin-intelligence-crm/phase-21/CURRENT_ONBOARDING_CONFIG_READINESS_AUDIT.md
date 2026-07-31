# Current Onboarding Config Readiness Audit

**Audited:** 2026-07-31  
**Domain root:** `lib/admin/customerSuccess/onboarding/`

| Check | Class | Evidence |
|-------|-------|----------|
| Configuration evaluate | PARTIAL | `lib/admin/customerSuccess/onboarding/readiness/configuration.js` — `evaluateConfigurationReadiness`; missing `subscriptionId` → `UNKNOWN` (`subscription_pin_missing`); missing Subscription model → `UNKNOWN`; not found → `NOT_READY`; found → `READY` with plan evidence only (does not invent subscription ACTIVE) |
| Accounting readiness | PARTIAL | `lib/admin/customerSuccess/onboarding/readiness/accounting.js` — `evaluateAccountingReadiness`; calls `assertOnboardingAccountingBoundary`; checklist unattested → `UNKNOWN` (never invents READY) |
| Accounting boundary | PARTIAL | `lib/admin/customerSuccess/onboarding/accountingBoundary.js` — `assertOnboardingAccountingBoundary` / `assertNoOnboardingAccountingCreate`; `createOnboardingJournalEntry` rejected — no journals/OB/stock posts from onboarding |
| System CoA admin | FORBIDDEN | Stays removed — onboarding must not own Tenant CoA / GL admin surfaces |
| Aggregate evaluate UNKNOWN≠READY | PARTIAL | `lib/admin/customerSuccess/onboarding/readiness/evaluate.js` — `overallFromDimensions` / `evaluateOnboardingReadiness`; any dimension `UNKNOWN` keeps overall `UNKNOWN`; stored snapshots never lift live UNKNOWN→READY; `isGoLiveReadinessAllowed` only READY / READY_WITH_WARNINGS |
| Subscription pin vs ACTIVE | GAP | Configuration path loads Subscription for pin/plan evidence only — authoritative ACTIVE evaluation is Wave 2 (G21-08); see subscription readiness audit |

**Gaps:** G21-12 → Wave 2 (config evidence honesty + accounting via governed services only).
