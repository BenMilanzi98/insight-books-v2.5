# Phase 6 Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Residual |
|---|---|---|---|---|---|
| R6-01 | Repair executed twice creates duplicate reversal/adjustment | Low | Critical | DB-unique repair identity + command hash + engine event registry; test-covered | Minimal |
| R6-02 | Wrong journal chosen as "authoritative" in a duplicate pair | Medium | High | Human investigation required (MEDIUM/HIGH confidence never auto-repairs); finance approval; reversal is itself reversible | Low |
| R6-03 | Unsupported balance "fixed" by invented journal | Low | Critical | Confidence gate + permitted-repairs list structurally block it; exception path is the only outlet | Minimal |
| R6-04 | Partial repair after mid-transaction failure | Low | High | Single-transaction execution; injected-failure tests prove zero partial state; safe retry | Minimal |
| R6-05 | Cross-tenant data touched during repair | Low | Critical | Tenant scoping on every query; cross-business targets refused; security tests | Minimal |
| R6-06 | Executor approves own high-risk repair | Low | High | Separation of duties enforced in registry, execution service, posting engine and batch service | Minimal |
| R6-07 | Batch content changes after review/approval | Low | High | Checksum stamped at review, revalidated at approval | Minimal |
| R6-08 | Repair run against production accidentally | Medium | Critical | CLI dual guard (flag + env var); API approval/backup gates; batch cannot execute unapproved | Low |
| R6-09 | Backup unusable when rollback needed | Low | Critical | Restore test mandatory and performed; batch approval requires validated backup reference | Low |
| R6-10 | Closed-period history altered without authorization | Low | High | Engine period validation + period-adjustment-only repair class + matrix approval | Minimal |
| R6-11 | Report defects "repaired" with journals | Medium | High | `REPORT_QUERY_ERROR` permits only `REPORT_ONLY_REPAIR` | Minimal |
| R6-12 | Detection misses anomaly classes present in production but not in dev data | Medium | Medium | Detection is idempotent and re-runnable per business; Stage 2 mandates production-like detection before any execution; exceptions remain visible | Open — monitor |
| R6-13 | Stored-balance fields still read by some legacy report paths | Medium | Medium | Phase 5 canonical authority for GL; remaining readers to be swept in Phase 7 report reconstruction | Open — Phase 7 |
| R6-14 | Long batches lock contended rows in production | Low | Medium | Per-action transactions; scheduling discipline (one batch per business); maintenance windows | Low |
| R6-15 | Evidence quality insufficient for finance approval on old records | Medium | Medium | EVIDENCE_INCOMPLETE status + exception register with disclosure; no forced repairs | Open — accepted |
