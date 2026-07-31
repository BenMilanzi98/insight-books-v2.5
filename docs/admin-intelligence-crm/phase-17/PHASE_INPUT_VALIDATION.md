# Phase 17 Input Validation

**Validated:** 2026-07-31  
**Upstream exit:** `READY_FOR_PHASE_17_WITH_BLOCKERS` (Phase 16 `FINAL_READINESS_DECISION.md` / `FINAL_PHASE_16_REPORT.md`)

## Sources checked

| Source | Path | Result |
|--------|------|--------|
| Phase 17 inputs | `docs/admin-intelligence-crm/phase-16/PHASE_17_INPUTS.md` | PRESENT — handoffs, CS assign, certificates, honesty gates listed |
| Readiness checklist | `docs/admin-intelligence-crm/phase-16/PHASE_17_READINESS_CHECKLIST.md` | PRESENT — must-be-true conversion plane checked; execution listed as carry |
| Final Phase 16 report | `docs/admin-intelligence-crm/phase-16/FINAL_PHASE_16_REPORT.md` | PRESENT — exit `READY_FOR_PHASE_17_WITH_BLOCKERS` |
| Onboarding handoff audit | `docs/admin-intelligence-crm/phase-16/CURRENT_ONBOARDING_HANDOFF_AUDIT.md` | PRESENT — handoff ≠ execute |
| Phase 8 onboarding audit | `docs/admin-intelligence-crm/phase-08/CURRENT_ONBOARDING_AUDIT.md` | PRESENT — NOT_INSTRUMENTED foundations |
| Design | `docs/superpowers/specs/2026-07-31-customer-onboarding-phase-17-design.md` | APPROVED 2026-07-31 — Approach 1 + Approach B |
| Plan | `docs/superpowers/plans/2026-07-31-customer-onboarding-phase-17.md` | PRESENT — Task 0 = this pack |

## Phase 16 must-be-true (consumed honestly)

| Gate | Evidence class |
|------|----------------|
| CrmConversionRequest / CrmConversion spine | CORRECT_AND_REUSABLE — `lib/admin/crm/conversions/*` |
| Customer / Tenant / Subscription pins on conversion | CORRECT_AND_REUSABLE — provision + subscription modules |
| CS assignment (ownership only) | CORRECT_AND_REUSABLE — `customerSuccess.js` `assignCustomerSuccessOwner`; `healthScore: null` |
| ONBOARDING handoff idempotent; `executionStatus` NOT_STARTED | CORRECT_AND_REUSABLE — `onboardingHandoff.js` + `handoffShared.js`; forces `onboardingCompleted: false` |
| TRAINING handoff distinct | CORRECT_AND_REUSABLE — `trainingHandoff.js`; `trainingCompleted: false` |
| MIGRATION handoff distinct | CORRECT_AND_REUSABLE — `migrationHandoff.js`; `productionImportExecuted: false` |
| MRA_EIS handoff distinct | CORRECT_AND_REUSABLE — `mraEisHandoff.js`; `fiscalSubmitted/credentialsStored: false` |
| Handoff ≠ execute | CORRECT_AND_REUSABLE — `serializeDomainHandoff` sets `recordOnly: true`, `executesDomainWork: false` |
| Completion certificate ≠ onboarding complete | CORRECT_AND_REUSABLE — `completion.js` `finalizeConversion` |
| Conversion reports honesty gate | CORRECT_AND_REUSABLE — `reliabilityGate.js` / `reports.js` |
| No Tenant GL from conversion | CORRECT_AND_REUSABLE — `accountingBoundary.js` |
| Payment initiation ≠ PAID; Closed Won ≠ ACTIVE | CORRECT_AND_REUSABLE boundary — do not assume PAID/ACTIVE |

## Phase 17 reuse plane (pre-Wave-1)

| Asset | Path | Class for Onboarding |
|-------|------|----------------------|
| Phase 16 ONBOARDING handoff | `lib/admin/crm/conversions/onboardingHandoff.js` | CORRECT_AND_REUSABLE — seed Request; never invent complete |
| Domain handoff shared | `lib/admin/crm/conversions/handoffShared.js` | CORRECT_AND_REUSABLE — types ONBOARDING/TRAINING/MIGRATION/MRA_EIS |
| `CrmConversionDomainHandoff` model | `prisma/schema.prisma` + `scripts/sql/crm-conversion-phase16-wave4.sql` | CORRECT_AND_REUSABLE |
| Phase 8 CsOnboardingRecord | `prisma` model + `foundations.js` | REUSE_WITH_RECONCILIATION — thin checklist; empty → NOT_INSTRUMENTED; link in Wave 4 |
| CS foundations UI/API | `app/insightbooks/customer-success/onboarding/page.js`, `app/api/admin/customer-success/foundations/route.js` | EXTEND / DISCONNECTED — foundations view only; not Request/Project spine |
| CS expansion handoffs | `lib/admin/customerSuccess/handoffs.js` | WRONG_DOMAIN for Closed-Won onboarding — record-only expansion ≠ ONBOARDING handoff |
| CS tasks | `lib/admin/customerSuccess/tasks.js` | WRONG_DOMAIN — case/playbook tasks ≠ onboarding Customer Tasks |
| Phase 13 Meetings | `lib/admin/crm/meetings/*` | CORRECT_AND_REUSABLE — kick-off; RSVP ≠ attendance |
| Tenant / Business / Branch provision | `tenantProvision.js`, `businessBranch.js` | CORRECT_AND_REUSABLE for readiness evaluation inputs |
| Invitations (hash-only) | `invitations.js` | CORRECT_AND_REUSABLE for user-access readiness |
| Accounting boundary pattern | `accountingBoundary.js` | REUSE_WITH_RECONCILIATION — mirror assert in onboarding modules |
| MRA EIS tenant domain | `lib/mraEis/**` | WRONG_DOMAIN for onboarding execution — coordinate via handoff + readiness checklist only |
| CS export | `lib/admin/customerSuccess/export.js` | EXTEND pattern — cases/tasks/plans/handoffs only; no onboarding Project export yet |
| `resolveCrmScope` | `lib/admin/crm/authz.js` | CROSS_TENANT_RISK — stub `mode: 'all'` |
| `CustomerOnboardingRequest` / Project | — | NOT_FOUND |
| `lib/admin/customerSuccess/onboarding/**` | — | NOT_FOUND |
| `app/api/admin/customer-success/onboarding*/**` | — | NOT_FOUND |
| Onboarding templates / materialisation | — | NOT_FOUND |
| Onboarding go-live / completion certificate | — | NOT_FOUND |

## Identity / handoff blockers?

**None** that block Wave 1 Request/Project spine + handoff consume + accept/convert + idempotency. Phase 16 ONBOARDING handoff exists, is distinct from TRAINING/MIGRATION/MRA_EIS, pins conversion/tenant in payload, and forces `executionStatus: NOT_STARTED` / `onboardingCompleted: false`. Customer/Tenant/Subscription pins come from conversion plane. Full execution domains remain Wave 2–3 / Phase 18 typed gaps.

## Validation verdict

**PASS** — Phase 16 exit is honest (`READY_FOR_PHASE_17_WITH_BLOCKERS`); design/plan locked; reuse plane identified (handoffs + Meetings + Phase 8 foundations CORRECT_AND_REUSABLE / REUSE_WITH_RECONCILIATION; Request/Project spine NOT_FOUND greenfield). Proceed to Wave 0 readiness decision (**CONDITIONAL GO**).
