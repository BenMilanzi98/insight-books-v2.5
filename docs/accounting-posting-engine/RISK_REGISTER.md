# Phase 4 Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Status |
| --- | --- | --- | --- | --- | --- |
| R4-01 | Legacy and V2 both post the same event during transition | Low | Critical | Bidirectional legacy guard + DB uniques; activation and legacy-disable are one flag | Mitigated, tested |
| R4-02 | Duplicate journals from retries/webhooks/double-clicks | Low | Critical | DB-backed idempotency, command hash, unique `accountingEventId` | Mitigated, tested |
| R4-03 | Shadow data leaks into production reports | Low | High | Separate tables, no production joins, boundary tests forbid shadow queries outside the kernel | Mitigated, tested |
| R4-04 | Partial posting after mid-transaction failure | Low | Critical | Single-transaction persistence, rollback tests, `je_v2_posted_requirements` | Mitigated, tested |
| R4-05 | Journal-number collision under concurrency | Low | Medium | Sequence table row-lock increment + unique `(tenantId, journalNumber)` | Mitigated, tested |
| R4-06 | Period resolver silently skips misconfigured dates (Phase 1 P1-F09 recurrence) | Low | High | Explicit gap/overlap errors; refusal when periods unconfigured | Mitigated, tested |
| R4-07 | Premature NEW_ENGINE activation for an unready business | Medium | High | Server-side mode resolution, readiness checklist, audited flag changes, default LEGACY | Procedural control — enforce checklist |
| R4-08 | V2 status strings diverge from legacy report expectations | Low | Medium | Legacy-compatible persisted statuses (`Posted`, …) + V2 machine on top | Mitigated |
| R4-09 | Approval framework is engine-native, not a shared workflow system | Medium | Medium | Contract isolated in `approvalValidation.js` for future replacement | Accepted, documented |
| R4-10 | Legacy `Transaction` store heterogeneity complicates Phase 5 ledger build | High | Medium | Documented in `PHASE_5_READINESS.md`; adapter/migration decision deferred to Phase 5 | Open (Phase 5) |
| R4-11 | Pre-existing failing tests mask new regressions | Medium | Low | Failures fingerprinted (8 tests, 6 files) and verified on clean tree; any new failure is visible | Monitored |
| R4-12 | In-process metrics lost on restart | High | Low | Durable counters derive from registry/attempt tables; process metrics are supplementary | Accepted |
| R4-13 | Windows UTF-16 migration-file encoding breaks deploys | Medium | Medium | Recovery procedure documented in `MIGRATION_VALIDATION.md`; write SQL as UTF-8 without BOM | Mitigated |
| R4-14 | DEFINED templates activated without full implementation | Low | High | `DEFINED` status cannot generate drafts; activation requires code + tests + flags | Mitigated |
