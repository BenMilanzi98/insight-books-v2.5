# Task P13-4 Review — Wave 4 Reminders + templates + automation + reports + Phase 14 pack

**Mode:** RE-REVIEW (after Important fixes: FAILED automation retry; template ACTIVE retire)  
**Prior:** REVIEW → **Needs fixes** (Important #1: FAILED executions poison idempotency; Important #2: DRAFT→ACTIVE via update skips retire)  
**Head:** `WORKING_TREE` (no commit, per brief)  
**Diff:** `.superpowers/sdd/task-p13-4-review-package.diff` (+ post-review fixes in working tree)  
**Brief / report:** `task-p13-4-brief.md` / `task-p13-4-report.md`  
**Read-only** (spec compliance + code quality; vitest re-run)  
**Date:** 2026-07-30  

**Vitest (re-run):**  
- `activityWave4` + `activityWave3` + `activityWave2` + `activityWave1` → **4 files, 43/43 passed**

---

### Prior Important findings — disposition

| Finding | Status | Evidence |
|---------|--------|----------|
| FAILED automation executions poison idempotency; retries return `ok: true` | **Fixed** | `executeAutomationRule` (`lib/admin/crm/automation/execute.js`): only `SUCCESS`/`SKIPPED` short-circuit as `ok: true` / `IDEMPOTENT_REPLAY`. Prior `FAILED` is retried and updated in place; P2002 race against non-success returns `ok: false` via `priorFailurePayload`. |
| `updateActivityTemplate` DRAFT→ACTIVE without retiring other ACTIVE | **Fixed** | `updateActivityTemplate` (`lib/admin/crm/templates.js`): when patch status is `ACTIVE`, `updateMany` retires other ACTIVE rows for the same `code` before activating (mirrors `createActivityTemplateVersion`). |
| Regression tests for both | **Fixed** | Wave 4: FAILED prior → retry runs action, updates row to SUCCESS, then SUCCESS replays idempotently; DRAFT→ACTIVE via update retires prior ACTIVE (single ACTIVE per code). |

---

### Spec Compliance

| Criterion | Status | Notes |
|-----------|--------|-------|
| Reminder dedupe; delivery ≠ Activity complete | ✅ | Unchanged; dedupe key + delivery never completes Activity. |
| Automation SoD + idempotency; small trigger set; no arbitrary code / sequences | ✅ | SoD + allow-list unchanged. Idempotency now success-only short-circuit; FAILED may retry (tested). |
| Reports honesty-gated; no false zeroes; schedules audited | ✅ | Unchanged. |
| FINAL_PHASE_13_REPORT exit READY_FOR_PHASE_14_WITH_BLOCKERS | ✅ | Unchanged. |
| No Demo / Proposal / Tenant provision / Google sync / telephony enablement | ✅ | Unchanged. |
| Vitest Wave 4 claimed PASS | ✅ | Re-run **43/43** (includes 2 post-fix regression tests). |
| Templates versioned; ACTIVE not directly editable | ✅ | In-place ACTIVE patch still blocked; activate-via-update and create-ACTIVE both retire prior ACTIVE. |
| Entity Activity projections (thin OK) | ✅ | Unchanged. |
| Prisma + SQL + APIs + thin UI stubs | ✅ | Unchanged. |
| No git commit | ✅ | Per brief/report. |

---

### Verify checklist (detailed)

1. **Reminder dedupe; delivery ≠ Activity complete** — Still solid.
2. **Automation SoD + idempotency; small trigger set** — Prior Important #1 closed: FAILED no longer masquerades as successful replay; retry updates in place to SUCCESS; subsequent SUCCESS replay remains idempotent (`ok: true`, no second Task).
3. **Reports honesty-gated; schedules audited** — Unchanged.
4. **FINAL_PHASE_13_REPORT exit** — Unchanged **READY_FOR_PHASE_14_WITH_BLOCKERS**.
5. **No Demo / provision / Google / telephony enablement** — Unchanged.
6. **Vitest Wave 4 PASS** — **43/43** re-confirmed.
7. **ACTIVE templates** — Prior Important #2 closed: DRAFT→ACTIVE via update retires siblings; in-place ACTIVE edit still rejected.

---

### Strengths

- FAILED-retry path preserves unique `idempotencyKey` (update-in-place) instead of inventing a second execution row.
- Template activate-via-update now shares the same retire semantics as version create.
- Wave 4 tests lock both Important scenarios without weakening prior Reminder/report/SoD coverage.
- Phase 14 exit pack still honest about blockers.

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

_None._ (Prior Important #1 and #2 fixed and verified.)

#### Minor (Nice to Have)

1. **Review package incomplete / noisy** — Package may omit some Wave 4 paths; working tree has them.
2. **SoD gap when `requestedByAdminId` is empty** — `approveAutomationRule` only blocks when requester id is present and equals approver.
3. **SUCCESS idempotent replay omits `result`** — Replay returns execution row; callers may need `resultJson` for `taskId`.
4. **`scheduleReminder` race** — find-then-create without P2002 mapping (unique key still protects DB).
5. **Concurrent FAILED retries can double-run the action** — Two concurrent retries after FAILED may both call `runApprovedAction` before either updates the row (no distributed lock). Acceptable for foundations; follow-up if production concurrency rises.
6. **UI hubs remain stubs** — Expected; APIs live.
7. **Prisma generate not run** — Report concern; model guards + SQL mitigate EPERM.

---

### Acceptance checklist (brief)

- [x] Reminder dedupe; delivery ≠ completion
- [x] Automation SoD + idempotency; small trigger set only — FAILED retry + success-only replay verified
- [x] Reports honesty-gated; schedules audited
- [x] FINAL_PHASE_13_REPORT + PHASE_14_INPUTS + CHECKLIST
- [x] Exit READY_FOR_PHASE_14_WITH_BLOCKERS
- [x] Vitest PASS (Wave 4 + prior activity suites) — **43/43** re-run
- [x] ACTIVE templates not directly editable — in-place blocked; DRAFT→ACTIVE retires prior ACTIVE

---

### Assessment

RE-REVIEW: Both prior Important gaps are closed. FAILED automation executions no longer short-circuit as `ok: true` idempotent replays (retry + in-place update; success-only replay thereafter). Activating a template via `updateActivityTemplate` retires other ACTIVE versions for the same code. Wave 4 regressions cover both paths; full re-run **43/43**. Remaining items are Minor and do not block Task quality.

**Task quality:** Approved
