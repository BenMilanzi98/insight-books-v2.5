# Task P13-1 Review — Wave 1 Activity spine + Task migrate + Follow-Up + Next-Action

**Mode:** RE-REVIEW (after Important fix)  
**Prior review:** Needs fixes — Task create soft-continued when Activity create failed  
**Head:** `WORKING_TREE` (no commit, per brief)  
**Diff:** `.superpowers/sdd/task-p13-1-review-package.diff` (+ subsequent Important fix in `lib/admin/crm/tasks.js` + Wave 1 test)  
**Brief / report:** `task-p13-1-brief.md` / `task-p13-1-report.md`  
**Read-only** (spec compliance + code quality; vitest re-run)  
**Date:** 2026-07-30  

**Vitest (re-run):**  
- `activityWave1` + `wave4` → **2 files, 19/19 passed** (includes new fail-closed Task create case)  
- `opportunityWave3` + `opportunityWave4` + `consent` → **3 files, 27/27 passed**  
- Combined → **5 files, 46/46 passed**

---

### Prior Important — disposition

| # | Finding | Status |
|---|---------|--------|
| Important #1 | Task create soft-continued without Activity when Activity model present but `createCrmActivity` failed | **Fixed** — `createTask` now returns Activity error and does not call `crmTask.create`; aligned with `createFollowUp`. Covered by `fail-closes Task create when Activity create fails (no orphan Task)`. |

---

### Spec Compliance

| Criterion | Status | Notes |
|-----------|--------|-------|
| CrmActivity parent; Task create links Activity type `TASK` | ✅ | Happy path links `TASK` Activity; when Activity model present and create fails → fail-closed (no orphan Task). Model-absent skip still OK (EPERM). Follow-Up already fail-closed. |
| `ACT-YYYY-######` unique / immutable / concurrency-safe | ✅ | `allocateCrmNumber` CAS via `CrmNumberSeq`; unique index; app never updates `activityNumber` after create; regex `CRM_ACTIVITY_NUMBER_RE`. |
| Type↔status fail-closed | ✅ | `isActivityStatusCompatible` + `canTransitionActivityStatus`; create/transition reject incompatibles; Planned + past `dueAt` stays Planned (tested). |
| Follow-Up consent-blocked not auto-executed | ✅ | Ineligible → `BLOCKED_BY_CONSENT`; `autoExecuted: false` on serialize/timeline; no send/SMTP path. |
| Next-action does not fabricate | ✅ | Reads existing open Task/Follow-Up only; envelopes `VALID`/`MISSING`/`OVERDUE`/`BLOCKED_BY_CONSENT`/`UNAVAILABLE`; always `fabricated: false`; `nextAction: null` when MISSING. |
| Notes RESTRICTED security preserved | ✅ | Create AuthZ unchanged; list uses `projectNotesForViewer`; Activity-linked RESTRICTED omitted for unprivileged (tested). |
| No Calls / Email / Meetings / Calendar / CsTask alias | ✅ | Wave 1 creatable types = TASK/FOLLOW_UP/NOTE only; no channel APIs; docs/foundations forbid CsTask alias; catalogue reserves CALL/EMAIL/MEETING for later. |
| Vitest Wave 1 claimed PASS | ✅ | Re-run confirms 19 + 27 (new fail-closed test adds +1 vs prior 18). |
| Required interfaces exported | ✅ | Activities surface + `createFollowUp`/`completeFollowUp`/`rescheduleFollowUp` + `evaluateNextAction`/`listNoNextActionOpportunities` (+ Lead variant). |
| Prisma + SQL + `hasCrm*Model` | ✅ | Schema models + `scripts/sql/crm-activity-phase13-wave1.sql` + guards. |
| APIs + thin UI stubs | ✅ | activities / follow-ups / next-action / task reopen; CRM hubs stubbed as reported. |
| No git commit | ✅ | Per brief/report. |

---

### Hard rules (detailed)

1. **Activity parent / Task link** — `createTask` calls `createCrmActivity` with `CRM_ACTIVITY_TYPE.TASK`. If `hasCrmActivityModel` and `!actResult.ok`, returns error (propagates `forbidden`/`reason`) and **does not** create `CrmTask`. Sets `activityId` on success. Complete/reopen sync Activity status. Model-absent → skip Activity (EPERM). Matches Follow-Up.
2. **ACT numbering** — Prefix `ACT`, UTC year, 6-digit seq, unique DB constraint, no mutation paths in status/get/list.
3. **Type↔status** — Compat map fail-closed (e.g. TASK ↛ `BLOCKED_BY_CONSENT`; FOLLOW_UP ↛ `IN_PROGRESS`). Transitions matrix; due date never auto-completes.
4. **Consent-blocked Follow-Up** — Eligibility gate when `contactId` + channel; blocked status on Follow-Up + Activity; no outbound execution.
5. **Next-action honesty** — No invented titles/actions; MISSING when empty; BLOCKED when only consent-blocked candidates remain.
6. **Restricted notes** — Service-layer omit/redact; Activity subject does not bypass.
7. **No deferred channels / CsTask** — Enforced in create allow-list + comments/foundations; API tree has no Calls/Email/Meetings/Calendar modules.
8. **Vitest** — Claimed PASS verified on re-run (46 tests).

---

### Strengths

- Clean module split under `lib/admin/crm/activities/` with catalogue re-export, numbering, create/get/list/status, relations, participants.
- Task and Follow-Up both fail-close on Activity create failure when the Activity model is live; Task path now mirrors Follow-Up (`tasks.js` ~99–121).
- Regression test deletes `crmNumberSeq` while keeping Activity model present — asserts `ok: false` and `crmTask.create` never called.
- Next-action evaluator is conservative (sort by due, prefer non-blocked, never fabricate).
- Idempotent task complete/reopen wired to Activity status.
- Tests cover catalogue compat, ACT allocation, Task link + reopen, fail-closed Task create, consent-blocked FU, next-action envelopes, restricted notes.

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

_None remaining._ Prior Important #1 is fixed and tested.

#### Minor (Nice to Have)

1. **Activity + child not one transaction** — Activity is created, then Task/Follow-Up. A later child `create` failure leaves an orphan Activity (and burned ACT number). Prefer `$transaction` (or compensate-delete Activity on child failure), matching prior CRM compensation patterns.
2. **Direction not validated on create** — `createCrmActivity` accepts any uppercase `direction` string; fail-closed against `CRM_ACTIVITY_DIRECTIONS` would match status hygiene.
3. **SQL fallback lacks FKs** — Wave 1 SQL creates tables/indexes without FK constraints that Prisma defines. Acceptable for EPERM apply path; document apply+generate order (already in report concerns).
4. **UI hubs are stubs** — Expected for Wave 1; APIs live. Not a spec miss.
5. **No backfill for legacy Task/Note `activityId`** — Documented; fine for Wave 1.
6. **Review package encoding artifacts** — Mojibake (`ΓåÆ` etc.) in the packaged diff; on-disk sources are fine. Package may also lag the Important fix (verify against working tree `tasks.js` + Wave 1 test).

---

### Acceptance checklist (brief)

- [x] Canonical Activity types/statuses/directions; incompatible status rejected
- [x] Unique immutable ACT numbers
- [x] Lead/Opportunity tasks link under Activity (single domain) — happy path + fail-closed when Activity create fails
- [x] Follow-Up + Next-Action / no-next-action; consent-blocked not auto-executed
- [x] Restricted notes still protected
- [x] Vitest PASS (Wave 1 + prior CRM task/timeline regression)

---

### Assessment

RE-REVIEW: Prior Important gap is closed. When the Activity model is present, Task create fails closed on Activity create failure (no orphan Task / null `activityId`), matching Follow-Up and the spine hard rule. Wave 1 tests now lock that path; full re-run 46/46. Remaining items are Minor (transactional pairing, direction enum, SQL FKs, stubs/backfill) and do not block Task quality.

**Task quality:** Approved
