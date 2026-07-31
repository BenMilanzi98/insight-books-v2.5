# Transactional Outbox Foundation

`MraEisOutbox` + `outboxService.js`: append (secret scan), claim SKIP LOCKED, lease recovery, dead-letter.
Event types in `EIS_OUTBOX_EVENT`.

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
