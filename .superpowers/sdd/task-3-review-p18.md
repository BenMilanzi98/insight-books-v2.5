# Task 3 Re-review — Phase 18 Wave 3 (Important fix wave)

**Reviewer:** defect-first gate (re-review)  
**Date:** 2026-07-31  
**Base / Head:** WORKING_TREE  
**Brief / report:** `task-3-brief-p18.md` / `task-3-report-p18.md` (Fix wave)  
**Scope:** Important #1–4 — `completion.js`, `grading.js`, `attempts.js`, `certificates.js`  
**Vitest:** Wave 1+2+3 → **37/37 PASS**

---

## Spec compliance: ✅

| Focus rule / Important fix | Verdict |
|----------------------------|---------|
| Attempt beyond limit; server timer authoritative | ✅ |
| Final result immutable; regrade preserves original | ✅ |
| Completion blocked without attendance | ✅ program-scoped PRESENT |
| Cert without completion; retry checksum; revoke → REVOKED | ✅ + idempotency_conflict on identity mismatch |
| Onboarding feed / no forged COMPLETED / Cross-Tenant | ✅ |
| List attempts omit answers | ✅ |
| Completion requires finalised assessment pass | ✅ `immutable` or `FINALISED` |
| Grade rejects `IN_PROGRESS` | ✅ `attempt_not_submitted_for_grading` |
| Vitest Wave 1+2+3 | ✅ 37/37 |

---

## Task quality: Approved

### Critical findings

None.

### Important findings

None remaining. Prior Important #1–4 addressed:

1. **Finalised-only completion** — `evaluateParticipantCompletion` requires `passed && (immutable || status === FINALISED)`.
2. **Program-scoped attendance** — PRESENT counted only when session `programId` matches enrolment program.
3. **Cert/attempt idempotency conflict** — mismatched `participantCompletionId` / `templateVersionId` or `assessmentVersionId` / `participantId` → `idempotency_conflict`.
4. **No grade on `IN_PROGRESS`** — `gradeAssessmentAttempt` allows only `SUBMITTED` / `GRADED` / `AUTO_GRADING` / `MANUAL_REVIEW`.

### Residual notes (non-blocking)

1. `evaluateParticipantCompletion` idempotent replay still skips program/participant payload match (same class as Wave 2; not in prior Important set).
2. Program completion / feed aggregate `COMPLETED` when any participant completed (Wave 4).
3. `listAssessmentAttempts` lacks program/tenant pin (mutations gated).
4. Prisma generate / db push still required for live client.

---

## Verdict

- **Spec compliance:** ✅  
- **Task quality:** Approved  
- **Critical:** 0  
- **Important:** 0  
- **Gate:** Clear for Wave 4 (residuals optional).
