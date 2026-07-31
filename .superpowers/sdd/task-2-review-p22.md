# Task 2 Review — Phase 22 Wave 2 Curriculum / trainers / enrolment honesty

**Reviewer:** SDD review subagent  
**Date:** 2026-07-31  
**Mode:** READ-ONLY (this review file only)  
**BASE_SHA:** `7d9709a897bc0d4609ce8a6725aad7d9cf1cb835` (WORKING_TREE; `lib/admin/customerSuccess/training/**` + Wave2 test + `prisma/schema.prisma` Invitation/Wave2 fields vs HEAD)  
**Scope (LIVE):** `curricula.js`, `materials.js`, `trainers.js`, `cohorts.js`, `participants.js`, `enrolment.js`, `invitations.js`, `conflicts.js`, `catalogue.js`, `model.js`, `index.js`; `test/systemAdmin.cs.trainingPhase22Wave2.test.js`  
**Spec / plan:** Spec §8 / plan Task 2; G22-07…13  
**Fix report:** `.superpowers\sdd\task-2-fix-report-p22.md`  
**Vitest (LIVE post-fix):** `npx vitest run test/systemAdmin.cs.trainingPhase22Wave1.test.js test/systemAdmin.cs.trainingPhase22Wave2.test.js test/systemAdmin.cs.trainingWave2.test.js` → **38/38 PASS**

## Focus checklist (LIVE)

| Focus | Result |
|-------|--------|
| ACTIVE / applied curriculum immutable | **PASS** — `assertCurriculumVersionMutable` refuses ACTIVE, `immutable===true`, or Program-applied; Wave2 test blocks content mutate |
| DRAFT authorable + role-module bind | **PASS** (post-fix) — schema `immutable @default(false)`; serializer `immutable === true`; freeze on ACTIVE; Wave2 proves bind then freeze |
| Product ≠ Training modules | **PASS** — `assertTrainingModuleNotProductModule`; explicit `productModuleRef` |
| Trainer qualification | **PASS** — skill/language mismatch → `trainer_*_qualification_mismatch` |
| Conflict → approved exception only | **PASS** (post-fix) — BLOCKED / APPROVAL_REQUIRED / **UNKNOWN** all require exception |
| Trainer capacity gate | **PASS** (post-fix) — capacity skipped only for `governedConflictException`; bare exception flags cannot bypass on `NO_CONFLICT` |
| Participant dedupe + scope | **PASS** — identityKey unique per program; Customer/Tenant/Business/Branch pinned; marketingConsent omitted from projection |
| Enrolment idempotent + capacity/prereq/UNKNOWN | **PASS** (shape) — waitlist/REGISTERED/ENROLLED; UNKNOWN blocks; capacity fail; prereq fail; exact-key replay |
| Invitation SENT ≠ DELIVERED ≠ REGISTERED | **PASS** — QUEUED→SENT→DELIVERED→REGISTERED; no invent without `deliveryEvidence`; invite≠attendance/enrolment on send |
| Restricted materials / answer keys | **PASS** — reauth required for RESTRICTED download URL; `projectMaterialForParticipant` strips answerKey/answerKeys/correctAnswers (+ deep strip) |
| Domain contract wave 2 | **PASS** — `phase: 22`, `treePhaseAlias: 18`, `wave: 2` |
| No attendance/completion/certs invented | **PASS** — invitation/enrolment paths set `attendanceCreated: false`; Wave2 tests assert |
| Vitest honesty | **PASS** — report 38/38 matches LIVE re-run |

## Issues

### Critical

None.

### Important

None remaining. Prior Important #1–#3 **FIXED** (verified LIVE against fix report):

1. ~~UNKNOWN assign without exception~~ → `needsException` includes `UNKNOWN`; refuses with `trainer_conflict_UNKNOWN_requires_approved_exception` unless exception flags set. Covered by Wave2 test.
2. ~~Exception flags bypass capacity on NO_CONFLICT~~ → capacity skip only when `governedConflictException` (`needsException && hasApprovedException`). Covered by Wave2 test.
3. ~~DRAFT / role-module bind dead under `immutable @default(true)`~~ → CurriculumVersion + ModuleVersion `@default(false)`; ACTIVE transition freezes; DRAFT bind then freeze covered by Wave2 test.

### Minor

1. **Enrolment idempotent replay skips input conflict check** — `enrolment.js:75-86` returns `alreadyExists` for the same key without comparing program/cohort/participant (invitation create does check). Same-key different body can silently return the wrong enrolment.
2. **Prerequisite gate trusts caller-supplied `completedPrerequisiteModuleCodes`** — no server completion/evidence lookup (acceptable deferral toward Wave 3 completion spine, but not an evidence gate yet).
3. **Restricted download reauth is shape-only** — any non-empty `downloadReauthToken` + `reauthorisedAt` grants URL; no token verification.
4. **Answer-key strip set is finite** — alternate keys (`answer`, `solutions`, nested marking schemes) are not in `ANSWER_KEY_FIELDS`; tested shapes are covered.

## Assessment

**Approved for Task 3.** Important #1–#3 are fixed and regression-covered; Vitest 38/38 PASS.

Invitation honesty, ACTIVE/applied curriculum freeze, DRAFT authoring + role-module bind, Product≠Training refs, trainer UNKNOWN/conflict + capacity gates, participant scope/dedupe, enrolment UNKNOWN/capacity/waitlist shapes, restricted reauth + answer-key projection strip remain solid. Residual Minors are Wave 3+ polish, not Task 2 blockers.

**Ready for Task 3?** yes

---

## Post-fix re-review

**Date:** 2026-07-31  
**Verdict:** **APPROVED** — Important #1–#3 closed; Critical 0 · Important 0 · Minor 4  
**Vitest:** 38/38 PASS (LIVE)  
**Ready for Task 3?** yes

---

**Counts:** Critical 0 · Important 0 · Minor 4  
**Path:** `.superpowers/sdd/task-2-review-p22.md`
