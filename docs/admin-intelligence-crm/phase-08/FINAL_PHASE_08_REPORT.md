# Phase 8 Final Report — Customer Health & Success Ops

**Decision:** **READY_FOR_PHASE_9_WITH_BLOCKERS**

Customer Health (explainable four-dimension engine with NOT_APPLICABLE renormalisation) and Customer Success ops (cases, tasks, interventions, renewals, playbooks, success plans, record-only expansion handoffs, export foundation) are shippable for authorised System Admin users with portfolio scope. Adoption, support, onboarding, and training remain explicitly uninstrumented or source-gated — never invented from logins or engagement proxies.

## Delivered

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Audits + matrices + readiness | Done |
| 1 | Health definition + evaluate + snapshots + APIs | Done |
| 2 | Health UI + CS shell/nav/i18n | Done |
| 3 | Cases / tasks / interventions / automation / renewals | Done |
| 4 | Playbooks / plans / foundations / handoffs / export / Phase 9 pack | Done |

## Surfaces (Wave 4)

### Libraries

- `lib/admin/customerSuccess/playbooks.js` — versioned definitions; `executePlaybook` expands steps → `CsTask` deterministically (idempotent per key+version+tenant+case)
- `lib/admin/customerSuccess/plans.js` — `CsSuccessPlan` / `CsSuccessGoal`
- `lib/admin/customerSuccess/handoffs.js` — `CsExpansionHandoff` record-only (`recordOnly: true`; no CRM opportunity / subscription mutation)
- `lib/admin/customerSuccess/foundations.js` — onboarding/training/survey → `NOT_INSTRUMENTED` unless source rows exist; `progressPercent` always null
- `lib/admin/customerSuccess/export.js` — portfolio-scoped JSON|CSV foundation
- Prisma + SQL: `CsPlaybook`, `CsPlaybookExecution`, `CsSuccessPlan`, `CsSuccessGoal`, `CsExpansionHandoff`, `CsOnboardingRecord`, `CsTrainingRecord`, `CsSurveyResponse`

### APIs

- `GET|POST /api/admin/customer-success/playbooks` (`mode=create|execute`)
- `GET|POST /api/admin/customer-success/plans` (`mode=plan|goal`)
- `GET|POST /api/admin/customer-success/handoffs`
- `GET /api/admin/customer-success/foundations?kind=onboarding|training|survey`
- `GET /api/admin/customer-success/export?dataset=&format=json|csv`

### UI

Live: playbooks, success plans, handoffs, reports. Foundations (onboarding/training/surveys) source-gated via foundations API — empty state **NOT_INSTRUMENTED**.

## Hard rules preserved

- Missing health dims never scored as 0; confidence separate from score
- Health never labelled churn/renewal probability
- Portfolio scope on tenant-bound Health and CS reads/mutations
- CS actions do not mutate `AccountSubscription` / billing / EIS source facts
- Automations idempotent; renewal outcomes require subscription evidence
- Expansion handoff is record-only — no auto plan upgrade, credits, refunds, or cancellations
- Never invent onboarding/training % from logins
- Never Tenant Sale; System CoA admin route stays removed

## Known blockers for Phase 9

1. **Adoption / FEATURE_USED** — still UNAVAILABLE / NOT_SUPPORTED; no product-usage facts
2. **Unique-user DAU/WAU/MAU** — login proxies only
3. **Support ticket plane** — NOT_INSTRUMENTED (CS cases are not support tickets)
4. **Onboarding / training / survey instrumentation** — foundation tables exist but empty → NOT_INSTRUMENTED until real source rows are written by product systems
5. **Prisma generate / db push** — Windows EPERM may still block generate; apply `scripts/sql/customer-success-phase08.sql` until push works
6. **Full CRM opportunities** — out of scope; handoffs are records only
7. **Export** — foundation only (capped, audited via CS scope); XLSX/PDF not offered

## Verification

```bash
npx vitest run test/systemAdmin.customerSuccess.test.js
```

Expected: PASS (Wave 3 + Wave 4 behaviours).

## Exit readiness

**READY_FOR_PHASE_9_WITH_BLOCKERS** — Health + core CS ops safe and explicit; adoption/support/onboarding/training gaps documented for Phase 9.
