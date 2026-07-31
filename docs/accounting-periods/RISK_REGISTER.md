# Risk Register — Phase 8

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | Legacy journals with ambiguous dates stay unassigned, blocking strict rollout | Medium | Medium | Migration leaves them as explicit exceptions; readiness gate blocks strict flags; Phase 6 repair path resolves them |
| 2 | Dual calendars (legacy + canonical) diverge during rollout | Medium | Medium | Legacy aliased via `legacyPeriodId`; integrity audit + monitoring detect drift; legacy page retired in Phase 9 |
| 3 | Business enables strict posting before mapping completes | Low | High | `assertMigrationComplete` hard guard + readiness statuses; flags are server-controlled |
| 4 | Close blocked indefinitely by a non-material defect | Medium | Low | Waivers (permissioned) and materiality-scoped exception acceptance; always-blocking list protects real defects |
| 5 | Reopened period misused for unrelated postings | Low | High | Adjustment authorization required, correction scope stored, re-close deadline monitored |
| 6 | Timezone edge cases misassign a boundary-day posting | Low | Medium | Date-only UTC normalization + business timezone in config; boundary-day tests |
| 7 | Users continue using legacy periods page after migration | Medium | Low | Sidebar promotes V2 page; legacy write paths gated by flags per business |
| 8 | Snapshot generation failure during closure | Low | Medium | Closure transaction rolls back atomically; retry after fixing the report defect |
| 9 | Performance of close checks on very large businesses | Medium | Medium | Checks batch through the report engine; production benchmark before broad rollout (Stage 4–5) |
| 10 | Approval fatigue → rubber-stamping | Medium | Medium | Separation of duties enforced structurally; audit trail exposes approval patterns |
