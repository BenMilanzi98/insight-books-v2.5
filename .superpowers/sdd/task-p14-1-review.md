# Task P14-1 Review — Wave 1 Request + Demo + schedule + participants + readiness spine

**Mode:** Spec + quality (read-only)  
**Head:** `WORKING_TREE` (no commit, per brief)  
**Diff:** `.superpowers/sdd/task-p14-1-review-package.diff`  
**Brief / report:** `task-p14-1-brief.md` / `task-p14-1-report.md`  
**Date:** 2026-07-30  

---

## RE-REVIEW (post Important fix)

**Date:** 2026-07-30  
**Focus:** Schedule always requires live Meeting + Calendar (`resolveLiveScheduleAnchors` + regression test)

**Vitest (re-run):**  
`npx vitest run test/systemAdmin.crm.demoWave1.test.js test/systemAdmin.crm.activityWave3.test.js test/systemAdmin.crm.activityWave1.test.js`  
→ **3 files, 24/24 passed** (was 23; +1 regression)  

`npx vitest run test/systemAdmin.crm.demoWave1.test.js`  
→ **1 file, 9/9 passed** (matches report post-review claim)

### Prior Important — verified fixed

| Prior finding | Status | Evidence |
|---------------|--------|----------|
| `scheduleDemo` skipped Calendar when `createMeeting` returned `alreadyExists` | **Fixed** | After every `createMeeting` (incl. `alreadyExists`) and on demo-side idempotent retries, `scheduleDemo` calls `resolveLiveScheduleAnchors` |
| Cancelled Meeting after calendar-create failure could SCHEDULE Demo | **Fixed** | Rejects `CRM_MEETING_STATUS.CANCELLED` with `meeting_cancelled_cannot_schedule_demo` before persist |
| Retry with live Meeting but missing Calendar could leave null `calendarEventId` | **Fixed** | Looks up non-cancelled Calendar by `meetingId`; recreates via `createCalendarEventForMeeting` when Meeting is live; fail-closed if recreate fails; `persistScheduledDemo` still requires both ids |

**Code path (`lib/admin/crm/demos/schedule.js`):**
- `resolveLiveScheduleAnchors` — Meeting required + not CANCELLED; live Calendar preferred / first non-cancelled; recreate if missing; never returns ok without both anchors.
- Idempotent early exit (`scheduleIdempotencyKey` / same window) also goes through anchors.
- Post-`createMeeting` path always re-verifies anchors (comment: “Always verify live Meeting + Calendar”).
- Regression: `schedule retry after calendar-create failure does not mark Demo SCHEDULED without Calendar` — first fail (Meeting CANCELLED, no Calendar), retry `ok: false` + `meeting_cancelled_cannot_schedule_demo`, Demo never SCHEDULED.

**Residual (non-blocking):** Same schedule idempotency key remains bound to the cancelled Meeting (Phase 13 `createMeeting` keeps the key). Retry correctly fails closed; operator must use a new key / new Meeting. Not a Demo schedule guard hole.

### Spec Compliance (RE-REVIEW)

| Criterion | Status | Notes |
|-----------|--------|-------|
| DMR / DEMO numbers unique immutable | ✅ | Unchanged |
| Qualify / convert; convert idempotent | ✅ | Unchanged |
| Schedule creates/links Meeting + Calendar; end-before-start / timezone via P13 | ✅ | Happy path + validation + **alreadyExists / calendar-fail retry fail-closed** |
| Readiness blocks when Meeting / presenter / Contact missing | ✅ | Unchanged |
| Demo ≠ Meeting | ✅ | Unchanged |
| No Agenda / Env / Proposal create | ✅ | Unchanged |
| RSVP ≠ attendance | ✅ | Unchanged |
| No Proposal / Tenant / auto Opportunity mutation | ✅ | Unchanged |
| Prisma + SQL + `hasCrm*Model` | ✅ | Unchanged |
| APIs + thin UI stubs | ✅ | Unchanged |
| Required interfaces exported | ✅ | Unchanged |
| Vitest claimed PASS | ✅ | Re-run 24/24 (+ Wave 1 9/9) |
| No git commit | ✅ | Per brief/report |

### Issues (RE-REVIEW)

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

_None remaining._ Prior Important closed by `resolveLiveScheduleAnchors` + regression test.

#### Minor (Nice to Have)

1. **Review package incomplete vs report** — Package may omit some WORKING_TREE hunks (prisma/catalogue/nav/locales). Cosmetic packaging only.
2. **READY effectively unreachable in Wave 1** — Deferred Agenda/Script/Env INFO keep max at `PARTIALLY_READY`. Acceptable honesty for the spine.
3. **UI hubs are stubs** — Expected; APIs live.
4. **Prisma generate not run** — Documented; SQL + `hasCrm*Model` path correct for EPERM.
5. **Cancelled Meeting sticky idempotency key** — After calendar-create failure, same key cannot succeed until a new key/Meeting; intentional fail-closed (document for operators if needed).

### Acceptance checklist (brief)

- [x] DMR/DEMO numbers unique immutable
- [x] Qualify/convert; convert idempotent
- [x] Schedule creates/links Meeting+Calendar (happy path + alreadyExists / calendar-fail retry fail-closed)
- [x] Readiness blocks when required items missing
- [x] Vitest PASS (re-run 24/24)
- [x] No Agenda/Env/Proposal create; Demo ≠ Meeting

### Assessment (RE-REVIEW)

Prior Important defect is closed. `scheduleDemo` always proves a non-cancelled Meeting and a live Calendar Event (lookup or recreate) before marking Demo `SCHEDULED`. Regression covers calendar-create-failed → retry. Wave 1 acceptance complete for schedule; remaining items are Minor / out-of-scope honesty.

**Task quality:** Approved

---

## Prior review (superseded)

**Vitest (then):** 3 files, 23/23 passed

### Spec Compliance (prior)

Schedule criterion was ⚠️ due to Important gap on `createMeeting` `alreadyExists` / calendar fail retry.

### Issues (prior) — Important

1. **`scheduleDemo` skips Calendar requirement when `createMeeting` returns `alreadyExists`** — closed in RE-REVIEW above.

### Assessment (prior)

**Task quality:** Needs fixes
