# Idempotency Foundation

DB uniques: terminal label, config version, site identity, sequence/day, snapshot source, transmission snapshot+mode, attempt number, offline snapshot, outbox idempotencyKey, sync idempotencyKey.
Same identity/different payload → typed conflict.

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
