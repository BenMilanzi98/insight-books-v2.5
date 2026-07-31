# Task P16-1 Review — Wave 1 Conversion request/plan/dry-run/orchestrator + Closed Won early

**Mode:** Spec + quality (read-only)  
**Head:** `WORKING_TREE` (no commit, per brief)  
**Diff:** `.superpowers/sdd/task-p16-1-review-package.diff`  
**Brief / report:** `task-p16-1-brief.md` / `task-p16-1-report.md`  
**Date:** 2026-07-31  
**Vitest:** Not re-run (per instructions); claimed 8/8 + Phase 12 readiness 1/1 verified by source/TDD case list  

---

### Spec Compliance: ✅ (with durability caveat)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Interfaces (createConversionRequest, readiness, plan, dryRun, execute, resume) | ✅ | `(prisma, args)` pattern; exported from `lib/admin/crm` + conversions barrel |
| Numbers `CVR-/CVN-YYYY-######` | ✅ | Shared `allocateCrmNumber` + catalogue prefixes/regexes |
| Phase 15 handoff → CVR idempotent | ✅ | `phase16Handoff.js` dynamic import → `createConversionRequestFromClosedWonHandoff`; key + acceptance dedupe |
| Dry-run zero operational side effects | ✅ | Preview + optional `CrmConversionDryRun` only; no Customer/Tenant/Subscription/Invoice; no Opp stage; no CVN |
| Closed Won via Phase 12 only | ✅ | Spot-check: sole Opp mutation path is `closeOpportunityWon` from `opportunities/close.js`; no `crmOpportunity.update` in `conversions/*` |
| Closed Won once at durable start | ⚠️ | Happy path + exact-retry after success call once; **incomplete CVN replay does not complete Closed Won** (Important #1) |
| Exact retry → existing CVN; conflicting hash fails | ✅ | Idempotency key + `inputHash` conflict → `idempotency_input_conflict` |
| Resume skips completed validate/closed-won | ✅ | Tested; `closeSpy` not called again; Closed Won retained |
| Provision steps Wave 1 skipped / not create | ✅ | `SKIPPED_NOT_APPLICABLE` for customer/tenant/subscription; honesty flags false |
| hasCrm*Model + SQL fallback | ✅ | Guards + `scripts/sql/crm-conversion-phase16-wave1.sql` + Prisma models |
| Thin API/UI stubs | ✅ | `conversion-requests` / `conversions` routes + insightbooks pages |
| Early Closed Won retained on later failure | ✅ | `simulateLaterStepFailure` + `closedWonRetained` |
| No commit | ✅ | WORKING_TREE |
| Vitest Wave 1 PASS (claim) | ✅ | Report 8/8; cases match brief TDD list (source) |

### Spot-check: `closeOpportunityWon`

- Production: `orchestrator.js` imports and calls `closeOpportunityWon` once inside `TRANSITION_OPPORTUNITY_CLOSED_WON` when step not completed; idempotency key `cvn-closed-won:${conversion.id}`.
- Exact retry / resume after completed step: no second call (asserted in tests).
- Test spy updates Opp via `crmOpportunity.update` **only inside the mock** — not production invent.

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

1. **Exact-retry / create-race replay returns `ok: true` without ensuring Closed Won ran** — `lib/admin/crm/conversions/orchestrator.js` (~119–163, ~200–223)  
   If durable `CrmConversion` insert succeeds then the process dies before the Closed Won step, a same-key retry hits `findUnique({ idempotencyKey })` / race handler and returns `alreadyExists` / `idempotentReplay` success without checking `closedWonAt` or completing `TRANSITION_OPPORTUNITY_CLOSED_WON`. That breaks the hard rule “Closed Won via Phase 12 once at durable start” under crash/retry. Fix: on exact replay, if Closed Won step incomplete, continue the spine once (or fail visibly / delegate to resume that completes it) — never report success with Opp still open.

2. **`resumeConversion` does not execute incomplete validate/Closed Won steps** — `orchestrator.js` (~469–524)  
   Resume only collects `skippedStepCodes` for completed steps and clears a failed Wave 1 boundary. Incomplete / failed Closed Won is never retried via `closeOpportunityWon`. Combined with Important #1, Wave 1 has no recovery path that still applies Closed Won exactly once. Resume should run incomplete Closed Won (Phase 12) when not completed, and still skip when completed.

3. **Request status force-update bypasses transition helper** — `orchestrator.js` (~235–248)  
   If `transitionConversionRequestStatus` returns `!ok`, code raw-updates CVR → `IN_PROGRESS` (no history, ignores transition table). Fail closed or surface the transition error instead (same class of defect as Phase 15 request reject bypass).

#### Minor (Nice to Have)

1. **Conversion terminal statuses skip `transitionConversionStatus`** — FAILED / PARTIALLY_COMPLETED / `closedWonAt` via raw `crmConversion.update`; status history incomplete after start.
2. **`transitionConversionStatus` has no transition table** — unlike request helper; any toStatus accepted.
3. **Phase 16 readiness soft-passes** when acceptance model absent but handoff/CVR pins exist — reported; unit-test friendly, tighten for production.
4. **Prisma generate / db push may EPERM** — SQL + `hasCrm*Model` mitigate; apply before runtime.
5. **UI stub i18n keys may render raw** — thin stub OK for Wave 1.
6. **Input hash omits evidence** — conflict coverage is planVersion/winReason/decisionDate; document or include evidence if material.

---

### Acceptance checklist (brief)

- [x] Vitest Wave 1 PASS (claimed 8/8; not re-run)
- [x] Dry-run side-effect free (operational domains)
- [~] Closed Won via Phase 12 only, once — happy path yes; crash/replay hole (Important #1–2)
- [x] Idempotent exact retry; conflicting fails
- [x] Thin routes exist
- [x] No Wave 2–3 provision; no commit

### Assessment

Wave 1 spine, dry-run honesty, Phase 12 Closed Won wiring (no direct Opp invent), numbering, handoff→CVR, SQL/`hasCrm*Model`, and thin stubs meet the brief on the happy path. Quality is **not** approved until exact-retry/resume cannot report success with Closed Won never applied.

**Spec:** ✅ (caveat: durability replay)  
**Task quality:** Not approved  
**Findings:** Critical 0 · Important 3 · Minor 6  

**Review path:** `.superpowers/sdd/task-p16-1-review.md`

---

## RE-REVIEW (after Important fixes)

**Date:** 2026-07-31  
**Diff:** `.superpowers/sdd/task-p16-1-review-package.diff` (AFTER FIX)  
**Vitest:** Not re-run; **11/11 confirmed at source** (`test/systemAdmin.crm.conversionWave1.test.js` — 11 `it(...)` cases including 3 fix-wave tests)

### Important #1–3 verification

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| 1 | Exact-retry/race replay success without Closed Won | **FIXED** | `continueOrReplayExistingConversion` returns `ok: true` only when `isClosedWonStepComplete`; else runs `runWave1EarlySpine` (fail visibly if Closed Won fails). Exact-retry + race paths both delegate here. Test: `exact retry completes incomplete Closed Won before reporting success`. |
| 2 | Resume does not execute incomplete Closed Won | **FIXED** | `resumeConversion` sets `needEarlySpine` when validate/Closed Won incomplete or Closed Won step missing; runs spine via `closeOpportunityWon`; still skips completed. Test: `resume executes incomplete Closed Won via Phase 12 (skips when completed)`. |
| 3 | CVR status force-bypass on `!ok` transition | **FIXED** | `ensureRequestInProgress` uses `transitionConversionRequestStatus` only; no `crmConversionRequest.update` in `orchestrator.js`. Execute/replay fail closed when `!reqTransition.ok` before Closed Won. Test: `CVR status update fails closed without force-bypass on illegal transition`. |

### Spec Compliance (re-check)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Closed Won once at durable start (+ crash/retry) | ✅ | Replay/resume complete incomplete Closed Won via Phase 12; completed steps skipped (no double call) |
| Exact retry / conflicting / resume | ✅ | Prior coverage retained + incomplete-CW recovery tests |
| Vitest Wave 1 PASS (claim) | ✅ | Report 11/11; source has 11 cases (brief TDD 7 + numbering CVN + 3 fix-wave) |
| Remaining brief acceptance | ✅ | Unchanged: dry-run honesty, thin stubs, no Wave 2–3, no commit |

### Remaining issues

#### Critical / Important

_None open._

#### Minor (unchanged; not blocking)

Prior Minor #1–6 still apply (terminal CVN status history, soft-pass readiness, EPERM, i18n stubs, input-hash evidence scope).

### Assessment (RE-REVIEW)

Important #1–3 addressed in `orchestrator.js` with matching tests. Durability caveat from first review is cleared. Spec met; quality approved. Minors remain optional.

**Spec:** ✅  
**Task quality:** Approved  
**Findings:** Critical 0 · Important 0 (open) · Minor 6 (pre-existing)  
**Vitest at source:** 11/11  

**Review path:** `.superpowers/sdd/task-p16-1-review.md`
