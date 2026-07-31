# Task 1 Review — Phase 17 Wave 1 (Request + Project spine)

**Base:** pre-Task1 WORKING_TREE · **Head:** WORKING_TREE · **Package:** `task-1-review-package.diff`  
**Suite:** not re-run (7 cases present; report GREEN trusted)

## Verdicts
- **Spec compliance:** ✅ (core spine; Important gaps below)
- **Task quality:** Changes required

## Critical
None.

## Important
1. **Handoff acknowledge skipped on idempotent replay** — `handoffConsume.js:176-181`. After Request create, `acknowledgeOnboardingHandoffInProgress` runs only when `!alreadyExists && !idempotentReplay`. If acknowledge fails/throws then client retries, replay skips acknowledge → handoff can stay `NOT_STARTED` forever. Acknowledge when still not `IN_PROGRESS` (ignore ack result only after success, or always re-attempt).
2. **Project create → Request `CONVERTED_TO_PROJECT` not durable on retry** — `projects.js:222-232` (+ `130-144`). Transition runs only after first create; `existingByKey` / `existingByRequest` replays return the Project without repairing Request status. Concurrent unique(`onboardingRequestId`) race catch (`193-215`) looks up by `idempotencyKey` only, not by request id. Wrap create+transition (or repair status on replay / catch by `onboardingRequestId`).

## Minor
- `allowIncompletePins` documented (`handoffConsume.js:79`) but unused; pins enforced at validate/accept/project (OK if intentional).
- Review package omits `prisma/schema.prisma` + `crm/catalogue.js` ONR/ONB (present on disk; verified).
- No auto-hook from Phase 16 emit → consume (API `action=consume` is the wire; acceptable Wave 1).

---

## Re-review (after Important fix wave)

**Date:** 2026-07-31  
**Package:** `task-1-review-package.diff` (fix-wave files)  
**Suite:** not re-run (implementer reported 9/9; trusted)

### Prior Important — disposition

| # | Finding | Status |
|---|---------|--------|
| 1 | Handoff ack skipped on idempotent replay | **Resolved** — `consumeOnboardingHandoff` always calls `acknowledgeOnboardingHandoffInProgress` after Request exists (create or replay). Covered by repair test. |
| 2 | Request `CONVERTED_TO_PROJECT` not durable + race lookup by key only | **Resolved** — `ensureRequestConvertedToProject` on `existingByKey`, `existingByRequest`, race catch, and create success; race catch resolves by idempotency key **or** `onboardingRequestId`. Covered by repair test. |

### Verdicts
- **Spec compliance:** ✅
- **Task quality:** Approved

### Critical
None.

### Important
None remaining.

### Minor / residual
- Consume response still defaults `handoffExecutionStatus` to `IN_PROGRESS` when ack returns no handoff payload (`ack?.handoff?.executionStatus || IN_PROGRESS`). Durability is fixed by replay ack; response accuracy if ack fails mid-call is cosmetic.
- Prior Minor items (unused `allowIncompletePins`, package omissions, no emit→consume auto-hook) unchanged; non-blocking for Wave 1.
