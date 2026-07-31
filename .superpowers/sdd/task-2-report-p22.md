# Task 2 Report — Phase 22 Wave 2 (Curriculum / trainers / cohorts / participants / enrolment honesty)

**Date:** 2026-07-31  
**Status:** **PASS**  
**Scope:** Harden `lib/admin/customerSuccess/training/**` Wave 2 surfaces + invitation lifecycle. No attendance/completion/certificates invented. No git commit.

## Verdict

Active curriculum versions applied to Programs are immutable. Product modules cannot be confused with Training modules (explicit `productModuleRef`). Trainer assignment enforces qualification + conflict gates (approved exception / `allowBlockedConflict` alias only). Participants pin Customer/Tenant/Business/Branch scope with identity dedupe; marketing consent never equated. Enrolment is idempotent with capacity, waitlist, and prerequisite gates; UNKNOWN blocks enrolment. Invitation lifecycle QUEUED→SENT→DELIVERED→REGISTERED is first-class; SENT≠DELIVERED≠REGISTERED; delivery never invented without evidence; invite≠attendance. Restricted materials require download reauth; answer keys stripped from Participant projections.

## Deliverables

| Item | Result |
|------|--------|
| Curriculum ACTIVE immutability + role-module bind | **DONE** — `updateTrainingCurriculumVersion` / `bindTrainingModuleRoleEntitlement` fail-closed when ACTIVE/applied |
| Product ≠ Training modules | **DONE** — `assertTrainingModuleNotProductModule` |
| Trainer qualification + conflict exception | **DONE** — skill/language/capacity; BLOCKED needs `approvedException` |
| Participant dedupe + scope + projection | **DONE** — scope fields; `projectTrainingParticipant` |
| Enrolment idempotent + capacity/prereq/waitlist | **DONE** — WAITLISTED / REGISTERED statuses |
| Invitation lifecycle | **DONE** — `invitations.js` + `CustomerTrainingInvitation` |
| Restricted materials / answer keys | **DONE** — reauth gate; `projectMaterialForParticipant` |
| Domain contract | **DONE** — `wave: 2` |
| Vitest Phase22 Wave 2 | **PASS** — `test/systemAdmin.cs.trainingPhase22Wave2.test.js` (10) |
| Regression | **PASS** — Phase22 Wave1 (12) + tree Wave2 (13) → **35/35** |

## Gaps closed (Wave 2)

| Gap | Disposition |
|-----|-------------|
| G22-07 | CLOSED — Invitation QUEUED/SENT/DELIVERED/REGISTERED; never invent delivery |
| G22-08 | CLOSED — Enrolment waitlist + REGISTERED distinct from invite |
| G22-09 | CLOSED — ACTIVE/applied curriculum immutable; role-module bind with Product ref |
| G22-11 | CLOSED — Restricted download reauthorise |
| G22-12 | CLOSED — Trainer qualification/capacity + approved exception for conflicts |
| G22-13 | CLOSED — Participant scope + consent≠Marketing projection |

## Key files

- `lib/admin/customerSuccess/training/curricula.js`
- `lib/admin/customerSuccess/training/materials.js`
- `lib/admin/customerSuccess/training/trainers.js`
- `lib/admin/customerSuccess/training/cohorts.js`
- `lib/admin/customerSuccess/training/participants.js`
- `lib/admin/customerSuccess/training/enrolment.js`
- `lib/admin/customerSuccess/training/invitations.js` *(new)*
- `lib/admin/customerSuccess/training/catalogue.js` / `model.js` / `index.js`
- `prisma/schema.prisma` — Invitation + Wave 2 field extends
- `test/systemAdmin.cs.trainingPhase22Wave2.test.js`

## Stop

SDD review gate before Wave 3. Do not invent attendance/completion/certificates; do not Demo→Training; invitation delivery evidence required.

**Vitest:** `npx vitest run test/systemAdmin.cs.trainingPhase22Wave1.test.js test/systemAdmin.cs.trainingPhase22Wave2.test.js test/systemAdmin.cs.trainingWave2.test.js` → **38/38 PASS**.

## Review fix notes (Important → closed)

Addressed `task-2-review-p22.md` Important items before Task 3:

1. **UNKNOWN conflict assign** — `assignTrainingTrainer` treats `UNKNOWN` like BLOCKED/APPROVAL_REQUIRED; requires approved exception.
2. **Capacity bypass** — exception flags only skip capacity when a governed conflict exception applies (`needsException && hasApprovedException`); `NO_CONFLICT` + flags still enforce capacity.
3. **DRAFT curriculum authoring** — `immutable @default(false)`; DRAFT bind/update works; freeze on ACTIVE; ACTIVE/applied remain immutable.

**Fix report:** `.superpowers/sdd/task-2-fix-report-p22.md`
