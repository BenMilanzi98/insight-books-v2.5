# Task 2 Review — Phase 17 Wave 2 (re-review after Important fixes)

**Base:** WORKING_TREE · **Head:** WORKING_TREE · **Package:** `task-2-review-package.diff`  
**Suite:** `test/systemAdmin.cs.onboardingWave1.test.js` + `onboardingWave2.test.js` → **23/23 passed**

## Verdicts
- **Spec compliance:** ✅
- **Task quality:** Approved

## Prior Important — resolution

| # | Finding | Status |
|---|---------|--------|
| 1 | materialise/kickoff `idempotency_conflict` on key payload disagree | **Resolved** — `materialise.js` compares `projectId` + `templateVersionId`; `kickoff.js` compares `projectId`; tests cover both |
| 2 | project materialise `templateVersion` mismatch | **Resolved** — pin check + existing-by-project check return `template_version_mismatch`; test covers |
| 3 | omitted `requestedScope` must not open CR | **Resolved** — `scope.js` early-returns when `requestedScope == null` (`skipped: true`, no CR); omitted + null tested |

## Critical
None.

## Important
None remaining.

## Minor (carry-forward, non-blocking)
- ACTIVE immutability is soft (flag + activate contentJson reject); no domain content-update API.
- Materialise does not require template version `ACTIVE`/`APPROVED`.
- Scope CR not de-duped on repeat `detectScopeMismatch`.
- Kick-off Meeting create then Kickoff row are not one DB transaction.

## Spec checklist
| Acceptance | Status |
|---|---|
| Materialise once on exact retry; key conflict on payload disagree | ✅ |
| Project replay rejects different templateVersionId | ✅ |
| Kick-off Meeting once; RSVP ≠ attendance; Meeting unavailable typed | ✅ |
| Customer Task complete needs evidence/waiver | ✅ |
| Evidence reject retains reason; portal not configured | ✅ |
| Scope mismatch → CR; omit/null requestedScope skips; no entitlement mutation | ✅ |
| Circular dependency rejected | ✅ |
| ACTIVE version immutable (domain path); stakeholder verified Contact | ✅ |
| No Tenant GL / WORKING_TREE OK | ✅ |

## Strengths
Focused fix wave; Wave 1-aligned `idempotency_conflict` shape; Vitest coverage for all three Important paths.
