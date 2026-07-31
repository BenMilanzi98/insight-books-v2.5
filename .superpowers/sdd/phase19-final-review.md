# Phase 19 Final Review — Customer Adoption (post–fix wave)

**Head:** `WORKING_TREE` (BASE `7d9709a`; Phases 7–19 dirty)  
**Scope:** Waves 0–4 adoption plane (`lib/admin/customerSuccess/adoption/**`, SQL, Vitest, APIs, UI hubs, exit docs)  
**Spec / plan:** `docs/superpowers/specs/2026-07-31-customer-adoption-phase-19-design.md` · `docs/superpowers/plans/2026-07-31-customer-adoption-phase-19.md`  
**Claimed exit:** `READY_FOR_PHASE_20_WITH_BLOCKERS` (`docs/admin-intelligence-crm/phase-19/FINAL_READINESS_DECISION.md`)  
**Package:** `.superpowers/sdd/phase19-final-review-package.md`  
**Prior review:** Changes requested (C1–C2, I1–I4) — stale pre-fix  
**Fix report:** `.superpowers/sdd/phase19-final-fix-report.md` (claims all fixed; **56** Vitest)  
**Mode:** Read-only whole-branch re-verification after fix wave  
**Date:** 2026-07-31  

---

## Strengths (preserved + post-fix)

1. **Training → Request honesty** — `consumeTrainingCompletionForAdoption` requires Program aggregate `COMPLETED` only; `COMPLETED_WITH_GAPS` / `IN_PROGRESS` rejected; program loaded via portfolio-scoped `loadTrainingProgramForAdoptionActor` before create.
2. **Plan COMPLETED gated** — `transitionAdoptionPlanStatus` → `COMPLETED` requires `evaluateAdoptionPlanCompletion` (manage + planAccess + all critical MET|WAIVED + value-review SIGNED_OFF + no blocking Critical DQ). Pure FSM COMPLETED forbidden.
3. **Milestone / value evidence honesty** — PRODUCT_ANALYTICS ignores client gate/snapshot unless `allowTestEvidenceInject`; HTTP milestones strip injects. Value outcomes: server Phase 9 or CS-attested (+ reason); client invent → UNAVAILABLE + `value: null`.
4. **Expansion ≠ execute** — record-only meta (`mutatesSubscription/Entitlement/Invoice/TenantGl: false`); ACK SoD default-enforced (`allowTestSoDBypass` only); HTTP does not accept client SoD disable.
5. **Dormancy portfolio + analytics honesty** — queue tenant via `resolveAdoptionListScope` + planAccess; foreign/`tenantId` override denied; missing analytics → UNAVAILABLE (not healthy-empty); RECOVERED needs server Phase 9 usage-return and/or outreach + reason (client snapshot ignored).
6. **Wave 4 portfolio honesty** — metrics/My Work/search/export/DQ/recon fail-closed; gate fail → UNAVAILABLE / `value: null`; thin stubs null + UNAVAILABLE; secrets stripped.
7. **Phase 8 / exit pack** — unique match else UNKNOWN; broken ≠ COMPLETED; WITH_BLOCKERS names Phase 18 carry + ML/portal/renewals-execute optionals.

---

## Live verification of prior findings

| ID | Verdict | Evidence |
|----|---------|----------|
| **C1** | **Fixed** | `dormancy.js` `resolveDormancyQueueTenant` — planAccess + `resolveAdoptionListScope`; mismatch / out-of-scope errors; Wave 3 foreign `tenantId` negative |
| **C2** | **Fixed** | `requests.js` / `trainingConsume.js` — `assertAdoptionTenantInScope` before create + idempotent recoveries; program portfolio load; Wave 1 cross-portfolio create/consume negatives |
| **I1** | **Fixed** | `validateAdoptionRequest` / `acceptAdoptionRequest` always `loadAdoptionRequestForActor` before ADR payload; Wave 1 early-return scope negatives |
| **I2** | **Fixed** | `valueOutcomes.js` — invent only via inject or CS-attest+reason; HTTP strips gate/invent path; Wave 2 forged → UNAVAILABLE |
| **I3** | **Fixed** | `attestDormancyOutcome` — server Phase 9 usage-return; HTTP omits client snapshot; Wave 3 forged/outreach tests |
| **I4** | **Fixed** | `acknowledgeExpansionHandoff` — `enforceCreatorAckSoD = allowTestSoDBypass !== true`; HTTP acknowledge omits client disable; Wave 3 SoD test |

### Spot-checks

| Hunt | Result |
|------|--------|
| WITH_GAPS no auto Request | **Holds** — `trainingConsume.js` COMPLETED-only + Wave 1 |
| Plan COMPLETED needs evaluation | **Holds** — `status.js` + `completion.js` + Wave 2 ungated reject |
| No client MET invent | **Holds** — `evidence.js` inject gate + Wave 2 |
| Expansion no billing | **Holds** — `RECORD_ONLY_META` + Wave 3 |
| Gate nulls / Wave 4 honesty | **Holds** — metrics/DQ/recon/export UNAVAILABLE + null |
| Exit WITH_BLOCKERS pack | **Honest** — decision + PHASE_20_INPUTS name optionals |

---

## Issues

### Critical

None residual.

### Important

None residual (I1–I4 cleared).

### Minor (carry — out of fix-wave scope)

#### [M1] Soft list authz smells — `listAdoptionMilestones` uses `!canManageAdoption(admin) && !admin`; champions list empty guard. Saved by `loadAdoptionPlanForActor`.
#### [M2] Thin AdminShell hubs — live API wiring limited; WITH_BLOCKERS UI polish incomplete.
#### [M3] Prisma EPERM → SQL fallback operational dependency (`scripts/sql/cs-adoption-phase19-*.sql`).
#### [M4] No HTTP surface for `transitionAdoptionPlanStatus` yet — library-gated COMPLETED is sound; when UI wires status, must not forward audited waivers casually.
#### [M5] `portfolioTenantIds` override in `listScope.js` trusts caller arrays without intersecting `resolveCsPortfolioScope` (carry test seam; HTTP list routes do not forward it).

---

## Risk

| Area | Residual risk |
|------|----------------|
| Cross-portfolio dormancy / ADR create/consume | **Low** — C1/C2 verified fixed |
| Validate/accept payload probe | **Low** — I1 verified |
| Value / dormancy RECOVERED invent | **Low** — I2/I3 verified |
| Expansion ACK SoD / billing execute | **Low** — I4 + record-only hold |
| False Plan COMPLETED / WITH_GAPS auto ADR / invent MET | **Low** — spot-checks hold |
| Metrics / DQ / export false zeroes | **Low** — Wave 4 honesty holds |
| Documented optional blockers | **Expected** — WITH_BLOCKERS pack honest |

Vitest **56** `it()` cases counted in Wave 1–4 files (18+18+11+9); matches fix report. This review did **not** re-run suites.

---

## Assessment vs claimed exit

**Claimed:** `READY_FOR_PHASE_20_WITH_BLOCKERS`  
**Reviewer verdict:** **Approved for exit as claimed**

Prior Criticals C1–C2 and Importants I1–I4 are repaired in product code with matching Vitest negatives. Residual items are Minors M1–M5 plus already-documented optional blockers (Phase 18 carry, ML churn, portal, renewals-execute). Exit claim is honest relative to hard rules.

**Findings tally (residual):** Critical **0** · Important **0** · Minor **5**  
**Strengths preserved:** Training COMPLETED-only auto Request, gated Plan COMPLETED, milestone/value inject honesty, dormancy portfolio fail-closed, expansion≠billing + SoD, Wave 4 fail-closed metrics/DQ/export, Phase 8 UNKNOWN policy, Phase 20 pack present.
