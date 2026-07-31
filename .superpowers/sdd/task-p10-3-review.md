# Task P10-3 Re-Review — P2 Fix Pass (read-only)

**Reviewer:** defect-first task-scoped gate  
**Base:** prior review (`task-p10-3-review.md`) + fix pass in `task-p10-3-report.md`  
**Scope:** verify three findings in WORKING_TREE (`clocks.js` + SLA tests); no code changes, no full suite re-run  

---

## Fix verification

| Prior finding | Verdict | Evidence |
|---------------|---------|----------|
| **[P2] `listClocksForTicket` — UNAVAILABLE on `findMany` throw** | **FIXED** | Initial `findMany` catch (lines 572–587) returns `status: UNAVAILABLE`, empty `items`, `meta.unavailable` + `support_sla_query_failed`; omits `breachRate` / `breachPercent` / `count`. Test: *listClocksForTicket returns UNAVAILABLE when findMany throws* (499–517). |
| **[P2] Resume/status hooks — pinned policy/calendar versions** | **FIXED** | `resolveClockPolicy` / `resolveClockCalendar` (206–222) resolve by clock pin via `getSlaPolicyByVersion` / `getSlaCalendarByVersion`; `resumeClock` requires caller-supplied pinned calendar (no silent default); `onTicketStatusChangeForSla` uses pins for ack, pause/resume, and CLOSED resolution stop; missing pin → `pinned_sla_version_unavailable` without invented dueAt math. Test: *resume/status hooks honor pinned calendarVersion* (519–630) — pinned UTC extend vs latest Blantyre 0 ms; missing pin soft-fails UNAVAILABLE with frozen dueAt. |
| **[P3] Post-eval refresh `findMany` unguarded** | **FIXED** | Post-`evaluateClockBreach` refresh wrapped in try/catch (596–611); same UNAVAILABLE envelope on throw. Status-hook resolution refresh also guarded (416–425). No dedicated test for second `findMany` failure; structurally mirrors fix #1. |

---

## Residual notes (non-blocking)

- **Library `ok` flag asymmetry:** model-missing path returns `ok: true` + `UNAVAILABLE`; query-failure path returns `ok: false` + `UNAVAILABLE`. SLA API maps `!result.ok` → HTTP 400; detail UI infers `UNAVAILABLE` when `!slaRes.ok`, so no false 0% breach in UI. Harmonizing to `ok: true` would align with model-missing and yield HTTP 200 + explicit `status` — optional polish, not a gate blocker.
- **P3 test gap:** post-eval refresh guard is code-verified only; acceptable for P3.
- **Report claims:** fix-pass vitest 33/33 on SLA + tickets + messages; not re-run per instructions. Prior-wave suites (attachments, assignment, nav) still assumed green from initial report.

---

## Spec compliance (unchanged)

All prior acceptance items remain **PASS**: FR/RESOLUTION clocks + business calendar, ack/SYSTEM_EVENT do not stop FR by default, `PUBLIC_AGENT_REPLY` does, breach append-only, Support nav/UI without fabricated breach metrics on unavailable paths, deferred channels out, global constraints honored.

---

## Overall

All three prior findings (two P2, one P3) are addressed in `lib/admin/support/sla/clocks.js` with targeted test coverage for the two P2 items. SLA_MATRIX rule 6 (pinned versions) and rule 7 (reliability / no fake zeroes) are now enforced on resume/status and query-failure paths.

**Task quality:** Approved
