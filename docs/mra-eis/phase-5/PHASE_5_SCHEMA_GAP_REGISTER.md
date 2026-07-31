# Phase 5 Schema Gap Register

| ID | Component | Classification | Resolution |
|---|---|---|---|
| G5-001 | Terminal aggregate tables | REPLACE (new) | `MraEisTerminal` |
| G5-002 | Plaintext credential columns | UNSAFE if added | Not added; vaultReference only |
| G5-003 | Config snapshots | NOT_APPLICABLE → new | `MraEisConfigurationSnapshot` |
| G5-004 | Fiscal sequence concurrency | NOT_APPLICABLE → new | `MraEisFiscalSequence` + FOR UPDATE |
| G5-005 | Immutable snapshots | NOT_APPLICABLE → new | Snapshot/Line/Payment |
| G5-006 | Transmission aggregate | NOT_APPLICABLE → new | Transmission/Attempt/Response |
| G5-007 | Legacy EISInvoice | DEPRECATE_LATER | Classified via dry-run script; no auto-submit |
| G5-008 | AcctV2Outbox for EIS | WRAP | Parallel `MraEisOutbox` |
| G5-009 | Offline browser IndexedDB | LEGACY_READ_ONLY | Server offline queue gated |
| G5-010 | Fiscal number algorithm | BLOCKED (Phase 1) | Placeholder `UNVERIFIED_PHASE5` |

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
