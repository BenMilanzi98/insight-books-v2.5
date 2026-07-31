# Phase 17 Final Review — Customer Onboarding

**Head:** `WORKING_TREE` (BASE `7d9709a`; Phases 7–17 dirty)  
**Scope:** Waves 0–4 onboarding plane (`lib/admin/customerSuccess/onboarding/**`, SQL, Vitest, APIs, exit docs)  
**Spec / plan:** `docs/superpowers/specs/2026-07-31-customer-onboarding-phase-17-design.md` · `docs/superpowers/plans/2026-07-31-customer-onboarding-phase-17.md`  
**Claimed exit:** `READY_FOR_PHASE_18_WITH_BLOCKERS` (`docs/admin-intelligence-crm/phase-17/FINAL_READINESS_DECISION.md`)  
**Package:** `.superpowers/sdd/phase17-final-review-package.md`  
**Ledger:** `.superpowers/sdd/progress-phase17.md` (Tasks 0–4 complete; 44 Vitest claimed)  
**Mode:** Read-only spot-check (handoffConsume, projects, materialise, kickoff, evidence, goLive, completion, reliabilityGate, search, FINAL_READINESS_DECISION)  
**Date:** 2026-07-31  

---

## Strengths

1. **Honest domain boundaries** — Handoff consume refuses fabricated completion and only acknowledges handoff `NOT_STARTED → IN_PROGRESS` (`handoffConsume.js`). Training COMPLETED requires Phase 18 domain source (`training.js` / readiness training dim). Portal typed `CUSTOMER_PORTAL_NOT_CONFIGURED` on evidence paths. Accounting boundary refuses journal/OB/stock creates and ambient-tenant-safe asserts (`accountingBoundary.js`).
2. **Idempotent spine** — Request/Project create, materialisation, kickoff schedule, and completion certificates use idempotency keys with conflict detection; Project pins ACTIVE `templateVersionId`; materialisation is once-per-project with template pin mismatch fail.
3. **Go-live honesty** — Approve/execute/SUCCESSFUL outcome re-evaluate readiness; UNKNOWN/BLOCKED blocked; Critical defects block; SUCCESSFUL must land in `STABILISATION`, never `COMPLETED` (`goLive.js`).
4. **Reliability gate** — Metrics/cards return `UNAVAILABLE` + `value: null` on permission/model/query fail; never invent KPI zeroes (`reliabilityGate.js`, `metrics.js`). Search fail-closed on empty portfolio; strips credentials; ONB/ONR numbers only (`search.js`).
5. **Phase 8 / Phase 18 pack** — Unlinked historical COMPLETED → UNKNOWN; linked without inventing Project COMPLETED (`phase8Migrate.js`). Exit docs + `PHASE_18_INPUTS` / checklist present; claimed WITH_BLOCKERS matches design intent for portal/migration engine/Training execution.

---

## Issues

### Critical

#### [C1] List APIs bypass CS manage authz and return unscoped fleet
**Paths:** `lib/admin/customerSuccess/onboarding/projects.js` (`listOnboardingProjects`), `requests.js` (`listOnboardingRequests`); wired by `app/api/admin/customer-success/onboarding/route.js` GET and `onboarding-requests/route.js` GET.

Guard is `if (!canManageOnboarding(admin) && !admin)`. Any authenticated admin object makes `!admin` false, so **permission denial never fires**. Then `findMany()` with **no portfolio/tenant filter**. Spec acceptance requires least privilege + Tenant isolation. Any logged-in System Admin without `customerSuccess.manageCases` can enumerate all ONR/ONB across tenants.

**Fix:** Require `canManageOnboarding` / `canViewOnboarding` explicitly; apply `resolveCsPortfolioScope` (fail closed when empty) before list.

#### [C2] Completion certificate can issue without go-live / stabilisation → Project COMPLETED
**Path:** `lib/admin/customerSuccess/onboarding/completion.js`

`issueCompletionCertificate` calls `evaluateOnboardingCompletion` with `requireGoLive: false`. Evaluation only pushes `go_live_successful_required` when `strictGoLive` is true; stabilisation exit is never checked. Sign-off + handover + recon alone can issue a checksummed certificate and transition `COMPLETION_PENDING → COMPLETED`. Wave 3 stop gate and spec §9/§15 require go-live → stabilisation → handover → evidence-based completion. This is a false-completion path.

**Fix:** Default-block certificate unless go-live SUCCESSFUL and stabilisation EXITED (plus existing sign-off/handover/recon); add Vitest negative cases.

### Important

#### [I1] Metrics/overview counts are global, not portfolio-scoped
**Path:** `metrics.js` — `getOnboardingMetric` / `getOnboardingOverviewCards` count all projects after `canViewOnboarding` only. Search/My Work are scoped; Overview KPIs leak cross-portfolio volumes to any CS viewer.

#### [I2] Migration dimension READY without reconciliation
**Path:** `readiness/evaluate.js` `evaluateMigrationDim` — `status === 'READY'` returns READY without recon check (COMPLETED path correctly requires recon). Spec: financial migration requires reconciliation; UNKNOWN ≠ READY. Go-live can proceed on READY migration coordination without recon.

#### [I3] `migratePhase8OnboardingRecords` mutates on view permission; ambiguous multi-project link
**Path:** `phase8Migrate.js` — allows `canViewOnboarding` (mutating migrate); links first Project by `tenantId` when many exist. Risk of wrong Project link + non-managers rewriting Phase 8 rows.

#### [I4] Project load by ID is not portfolio-scoped when actor tenant pin absent
**Path:** `projectAccess.js` — cross-tenant denial only when `actorTenantId` is set. CS agents with multi-tenant portfolios and no pin can open any project by id (search is scoped; IDOR-style load is not).

#### [I5] `executeGoLive` idempotency optional
**Path:** `goLive.js` — without `idempotencyKey`, retries can create multiple go-live rows. Spec hard rule: exact retries must not duplicate go-live records. Prefer required key (same pattern as kickoff/materialise/certificate).

### Minor

#### [M1] Wave 2 template SoD soft only (author≠approver not hard-enforced) — known carry.
#### [M2] Thin Overview UI documents card fetch but does not live-call metrics API — known carry.
#### [M3] Prisma EPERM → SQL fallback path remains operational dependency — known carry.
#### [M4] `customerApproval` / `internalApproval` readiness dims recorded but excluded from `CORE_DIMENSIONS` overall rollup (execute path still checks approval rows separately).
#### [M5] `approveGoLive` has no idempotency — duplicate APPROVED rows per role possible.

---

## Risk

| Area | Residual risk |
|------|----------------|
| Authz / isolation | **High** until C1 (+ I1/I4) fixed — fleet list and KPI/ID access undermine CS portfolio model |
| False completion | **High** until C2 fixed — certificate can mark COMPLETED without go-live/stabilisation |
| Go-live readiness | **Medium** — I2 can green-light migration READY without recon |
| Phase 8 migrate | **Medium** — wrong-tenant project link / view-as-mutate |
| Honesty boundaries (training, accounting, portal, gate zeroes, handoff) | **Low** — spot-checks hold |
| Exit blockers (portal / migration engine / MRA fiscal / e-sign) | **Expected** — correctly documented WITH_BLOCKERS |

Vitest 44/44 claimed in ledger/package; this review did **not** re-run suites (read-only). Tests cover happy-path certificate checksum but do not assert go-live/stabilisation as certificate prerequisites; list authz hole is untested.

---

## Verdict

**NOT_READY_FOR_PHASE_18** — do not treat claimed `READY_FOR_PHASE_18_WITH_BLOCKERS` as ratified until **C1** and **C2** are repaired and covered by Vitest.

After Critical fixes: exit may become **`READY_FOR_PHASE_18_WITH_BLOCKERS`** with Important items (I1–I5) as explicit Phase 18 preconditions / quick follow-ups, plus already-documented optional blockers (portal, migration engine, Training execution, MRA fiscal, payment/e-sign).

**Findings tally:** Critical **2** · Important **5** · Minor **5**  
**Strengths preserved:** handoff/training/accounting honesty, reliability gate nulls, go-live→stabilisation path, Phase 8 UNKNOWN policy, Phase 18 pack present.

---

## Post-fix verification

**Date:** 2026-07-31  
**Against:** `phase17-final-fix-report.md` + spot-check of `listScope.js`, `completion.js`, `projects.js`, `requests.js`, `metrics.js`, `goLive.js`, `phase8Migrate.js`, `projectAccess.js` (+ readiness `evaluate.js` for I2)

| ID | Verdict | Evidence |
|----|---------|----------|
| **C1** | **CLEARED (real fix)** | Lists require `canView`/`canManage` (no `&& !admin` bypass). `resolveOnboardingListScope` + `tenantWhereFromScope`; empty portfolio fail-closed (empty list / forbidden). Super Admin `mode=all` only unscoped path. |
| **C2** | **CLEARED (real fix)** | `issueCompletionCertificate` forces `requireGoLive: true` + `requireStabilisation: true`. Eval blocks `go_live_successful_required` / `stabilisation_exit_required` unless audited type-policy waiver. COMPLETED transition still only after certificate ready. |
| **I1** | Cleared | Metrics/overview use list scope; empty → `UNAVAILABLE` / `value: null`. |
| **I2** | Cleared | `READY` / `READY_FOR_IMPORT` / `COMPLETED` need recon; without → `NOT_READY`. |
| **I3** | Cleared | Manage-only migrate; unique tenant(+customer) match; else UNKNOWN. |
| **I4** | Cleared | `loadOnboardingProjectForActor` enforces portfolio scope even without tenant pin. |
| **I5** | Cleared | `executeGoLive` requires `idempotencyKey`; exact retry replays same row. |

**Residual Criticals:** none.  
**Known remainders:** M1–M5 + documented Phase 18 blockers (portal, migration engine, Training execution, MRA fiscal, payment/e-sign).

### Verdict

**READY_WORKING_TREE_WITH_BLOCKERS** — Critical C1/C2 are actually fixed (not papered over); I1–I5 remediated as claimed. Proceed under documented WITH_BLOCKERS exit, not as Critical-authz/false-completion NOT_READY.
