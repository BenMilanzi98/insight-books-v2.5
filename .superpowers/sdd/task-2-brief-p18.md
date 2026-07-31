### Task 2: Wave 2 — Participants, trainers, cohorts, Sessions (Phase 13), conflicts, attendance, materials/env boundary

**Files:**
- Create: `participants.js`, `enrolment.js`, `trainers.js`, `cohorts.js`, `sessions.js`, `conflicts.js`, `attendance.js`, `materials.js`, `environment.js`
- Create: `scripts/sql/cs-training-phase18-wave2.sql` + Prisma models as needed
- Wire: `lib/admin/crm/meetings` for Session Meeting create/link; RSVP ≠ attendance
- Test: `test/systemAdmin.cs.trainingWave2.test.js`

**Interfaces:**
- Produces:
  - Participant verify/enrol; duplicate identity blocked; UNKNOWN blocked from restricted materials
  - Trainer assign with skill/language/conflict checks
  - Cohort create with capacity
  - `scheduleTrainingSession({ programId, cohortId, meetingInput, idempotencyKey })` → `crmMeetingId`; Meeting unavailable → `MEETING_SERVICE_UNAVAILABLE`
  - Conflict evaluation; BLOCKED/UNKNOWN ≠ confirmable as NO_CONFLICT
  - `captureTrainingAttendance` / `correctTrainingAttendance` (preserve original); invitation/calendar/link sources rejected
  - Materials classification + private download boundary; environment isolation assert (no Production data)
  - Virtual provider path returns `VIRTUAL_PROVIDER_NOT_CONFIGURED`

- [ ] **Step 1: Write failing Vitest** — Meeting once on retry; RSVP≠attendance; trainer overlap blocks confirm; attendance rejects invitation source; correction preserves original; UNKNOWN participant denied restricted material; env isolation assert; virtual provider typed unavailable
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** lib + SQL + thin UI tabs
- [ ] **Step 4: Re-run Wave 1+2** — PASS
- [ ] SDD review gate before Wave 3

---
