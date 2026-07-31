# Task 2 Report ù Phase 18 Wave 2 (Participants / Sessions / attendance)

**Date:** 2026-07-31  
**Status:** COMPLETE (GREEN)  
**Commit:** none (per brief)

---

## Summary

Implemented Phase 18 Wave 2 under `lib/admin/customerSuccess/training/**`: Participants/enrolment, Trainers, Cohorts, Sessions?Phase 13 Meetings, conflicts, source-backed attendance, materials classification, environment isolation, and typed virtual-provider unavailable. SQL + Prisma models, thin Program tabs + sessions API, Vitest Wave 1+2 green.

---

## RED

```text
npx vitest run test/systemAdmin.cs.trainingWave2.test.js

 FAIL  test/systemAdmin.cs.trainingWave2.test.js
 TypeError: createTrainingCohort is not a function
 ù
 TypeError: getVirtualProviderStatus is not a function
 Test Files  1 failed (1)
      Tests  11 failed (11)
```

Failure mode: missing Wave 2 domain exports (expected before implementation).

---

## GREEN

```text
npx vitest run test/systemAdmin.cs.trainingWave2.test.js test/systemAdmin.cs.trainingWave1.test.js

 Test Files  2 passed (2)
      Tests  21 passed (21)
 Duration  ~3.31s
```

| Case | Result |
|------|--------|
| Session schedule ? Meeting once on exact retry | PASS |
| RSVP accepted ? attendance; calendar source rejected | PASS |
| Trainer overlap BLOCKED; confirm ? NO_CONFLICT | PASS |
| Invitation / calendar / link attendance sources rejected | PASS |
| Correction preserves original attendance row | PASS |
| UNKNOWN participant denied RESTRICTED material | PASS |
| Shared practice env + Production data blocked | PASS |
| Virtual provider ? `VIRTUAL_PROVIDER_NOT_CONFIGURED` | PASS |
| Meeting unavailable ? `MEETING_SERVICE_UNAVAILABLE`; no Session row | PASS |
| Duplicate participant identity blocked | PASS |
| UNKNOWN conflict not confirmable as NO_CONFLICT | PASS |
| Wave 1 regression (10 tests) | PASS |

---

## Deliverables

| Area | Path |
|------|------|
| Domain | `lib/admin/customerSuccess/training/{participants,enrolment,trainers,cohorts,sessions,conflicts,attendance,materials,environment}.js` (+ catalogue/numbering/model/index updates) |
| SQL | `scripts/sql/cs-training-phase18-wave2.sql` |
| Prisma | `CustomerTraining{Cohort,Participant,Enrolment,Trainer,TrainerAssignment,Session,Attendance,Material,Conflict}` |
| Prefixes | `CRM_NUMBER_PREFIX.COH` / `TRS` |
| API | `app/api/admin/customer-success/training-sessions/route.js` |
| UI | `app/insightbooks/customer-success/training/programs/[id]/{page,cohorts,participants,trainers,sessions,attendance,materials,environment}/page.js` |
| Test | `test/systemAdmin.cs.trainingWave2.test.js` |

### Interfaces shipped

- `verifyTrainingParticipant` / `enrolTrainingParticipant` ù duplicate identity blocked; UNKNOWN verification retained
- `assignTrainingTrainer` ù skill/language + overlap conflict checks
- `createTrainingCohort` ù capacity + `COH-YYYY-######`
- `scheduleTrainingSession` ? `crmMeetingId`; unavailable ? `MEETING_SERVICE_UNAVAILABLE`; exact retry same Meeting
- `recordTrainingSessionRsvp` ù RSVP ? attendance
- `evaluateTrainingConflicts` / `confirmTrainingSchedule` ù BLOCKED/UNKNOWN ? NO_CONFLICT
- `captureTrainingAttendance` / `correctTrainingAttendance` ù forbidden sources rejected; original preserved
- `assertRestrictedMaterialAccess` ù UNKNOWN denied RESTRICTED
- `assertTrainingEnvironmentIsolation` ù no Production data in shared practice
- `getVirtualProviderStatus` / `requestVirtualTrainingProviderSession` ? `VIRTUAL_PROVIDER_NOT_CONFIGURED`

---

## Out of scope (correctly deferred)

- Exercises / assessments / certificates / Phase 17 outcome feed (Wave 3)
- Rich calendar hubs / metrics / DQ (Wave 4)
- Real virtual meeting provider integration
- Tenant GL / Subscription / entitlement mutations

---

## Concerns / follow-ups

1. **Prisma client generate / db push not run** ù schema + SQL fallback present; live DB needs `db push`/`generate` (or SQL apply) before production APIs hit real Prisma client.
2. **UI/API are thin stubs** ù Program tab shells + action route wired; no rich schedule UX yet.
3. **Trainer assignment with `allowBlockedConflict`** ù records BLOCKED assignment for evaluation; confirm still fail-closed (by design for tests / approved-resolution placeholder).
4. **SDD review gate** before Wave 3.

---

## Verification commands

```bash
npx vitest run test/systemAdmin.cs.trainingWave1.test.js test/systemAdmin.cs.trainingWave2.test.js
```

## Fix wave

Review Critical + Important findings addressed (no git commit):

1. **Critical ó `confirmTrainingSchedule`** always re-evaluates conflicts server-side; ignores caller `conflictState` / `forceUnknown`. BLOCKED / UNKNOWN / APPROVAL_REQUIRED cannot confirm; client-spoofed `NO_CONFLICT` rejected.
2. **Important ó Session create race catch** wraps `customerTrainingSession.create`; on unique failure loads by `idempotencyKey` and returns exact replay or `idempotency_conflict`.
3. **Important ó Idempotent Session replay** validates `programId` + `cohortId` + schedule identity (`timezone` / `startsAt` / `endsAt`); disagree ? `idempotency_conflict`.

### Tests added / extended

- Trainer overlap: spoofed `conflictState: NO_CONFLICT` still BLOCKED
- UNKNOWN via incomplete schedule: spoofed `NO_CONFLICT` still UNKNOWN
- Session idempotency cohort/schedule conflict + race-catch exact replay / conflict

### Command output

```text
$ npx vitest run test/systemAdmin.cs.trainingWave1.test.js test/systemAdmin.cs.trainingWave2.test.js

 RUN  v4.1.2 C:/laragon/www/insight-books-v2.5

 Test Files  2 passed (2)
      Tests  22 passed (22)
 Duration  ~1.52s
```
