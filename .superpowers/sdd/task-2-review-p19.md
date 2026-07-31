# Task 2 Review — Phase 19 Wave 2 (Milestones / value / Phase 9 evidence / completion)

**Reviewer:** defect-first gate (re-review AFTER fix)  
**Date:** 2026-07-31  
**Base / Head:** WORKING_TREE  
**Brief / report / package:** `task-2-brief-p19.md` / `task-2-report-p19.md` / `task-2-review-package-p19.diff`  
**Spec/Plan:** `docs/superpowers/plans/2026-07-31-customer-adoption-phase-19.md` Task 2 + Global Constraints  
**Vitest (re-run):** `npx vitest run test/systemAdmin.cs.adoptionWave2.test.js test/systemAdmin.cs.adoptionWave1.test.js` → **34/34 PASS**

---

## LIVE gate checks (post-fix)

| Gate | Live evidence | Verdict |
|------|---------------|---------|
| No fabricate MET via HTTP | `adoption-milestones` POST `evaluate` does **not** forward `analyticsGate` / `phase9Snapshot`; `resolveProductAnalyticsEvidence` ignores inject unless `allowTestEvidenceInject: true`; MET via `readPhase9ProductEvidence` (`loadFirstValue` / `evaluateAdoptionState` / `evaluateProductSignalsForTenant`) | ✅ Critical cleared |
| Attest mode-limited | `attestAdoptionMilestone` → `attestation_mode_forbidden` unless `CS_ATTESTATION` (MET) or `MIXED` (attestation leg / IN_PROGRESS); PA/TC cannot MET via attest | ✅ Critical cleared |
| Value READY path | `measuredMissing = !hasMeasuredValue && !hasValueAlias`; API `measuredValue: body.measuredValue ?? body.value` → READY with non-null value | ✅ Important cleared |
| Waiver planAccess | `evaluateAdoptionPlanCompletion` calls `loadAdoptionPlanForActor` **before** `hasAuditedCompletionWaiver`; cross-tenant denied | ✅ Important cleared |
| Analytics fail / missing ≠ MET | Gate fail + unreadable Phase 9 → `UNAVAILABLE` / `meetsDefinition: false`; honesty clamp | ✅ |
| Plan COMPLETED policy | Critical MET\|WAIVED + value review + DQ; manage + planAccess | ✅ |
| TRAINING_CERT honesty | WITH_GAPS alone ≠ MET when `requireProgramCompleted` | ✅ |
| planAccess on writes | materialise / evaluate / attest / waive / record / sign-off / completion / transition | ✅ |

---

## Spec compliance: ✅

| Brief / global rule | Verdict |
|---------------------|---------|
| Materialise from pinned template (idempotent) | ✅ |
| Evidence modes PRODUCT_ANALYTICS / TRAINING_CERT / CS_ATTESTATION / MIXED | ✅ |
| Gate fail / missing → UNKNOWN + UNAVAILABLE (never MET) | ✅ |
| Wire Phase 9 `firstValue` / `adoption` / `signals` read-only | ✅ server-side; Vitest inject flag only |
| TRAINING_CERT WITH_GAPS alone ≠ MET | ✅ |
| Attest/waive manage + planAccess; critical SoD; attest mode-limited | ✅ |
| Value null/UNAVAILABLE not false zero; READY when measured | ✅ |
| Plan COMPLETED evaluation + gated transition; waiver after planAccess | ✅ |
| Any-one / ungated COMPLETED rejected | ✅ |
| Vitest Wave 1+2 GREEN | ✅ 34/34 |

---

## Prior findings disposition

### Critical (was 2) — fixed

1. ~~Strip client evidence inject; wire Phase 9~~ — HTTP evaluate stripped; `allowTestEvidenceInject` required for test inject; `readPhase9ProductEvidence` wired. Covered by inject-deny + server Phase 9 MET tests.
2. ~~Restrict `attestAdoptionMilestone`~~ — mode gate to CS_ATTESTATION / MIXED. Covered by `attestation_mode_forbidden` test.

### Important (was 2) — fixed

1. ~~`measuredMissing` OR-bug~~ — READY when either alias present. Covered by measuredValue READY test.
2. ~~Waiver before planAccess~~ — access first. Covered by cross-tenant waiver deny test.

---

## Strengths

1. Completion policy remains real: critical MET\|WAIVED + value review + blocking DQ; FSM alone cannot COMPLETE.
2. Public evaluate surface cannot invent PRODUCT_ANALYTICS MET; Phase 9 read path is the only production MET path.
3. Attest cannot bypass analytics/training honesty modes.
4. Wave 1+2 regression green (34/34).

---

## Task quality: Approved with notes

### Critical findings

None.

### Important findings

None.

### Minor notes (non-blocking)

1. `listAdoptionMilestones` authz (`!canManage && !admin`) is looser than `canViewAdoption`; `planAccess` still fail-closes.
2. Zero-`critical` templates vacuously satisfy critical completion — consider requiring ≥1 critical or template policy.
3. Critical waive without prior attest skips SoD (attestor unset) — confirm intentional for executive waiver.
4. Prisma generate / db push may still hit Windows EPERM; SQL + `hasModel` UNAVAILABLE guards remain (reported).
5. Domain `evaluateAdoptionMilestone` still accepts `allowTestEvidenceInject` when callers pass it — HTTP does not forward; keep that invariant on any future thin wrappers.

---

## Verdict

- **Spec compliance:** ✅  
- **Task quality:** Approved with notes  
- **Critical:** 0  
- **Important:** 0  
- **Gate:** Wave 3 unblocked for Task 2; minors optional follow-ups.
