# Closing Journal Batch

Entity: `CloseV2ClosingJournalBatch` (+ lines).

Flow: generate preview → READY_FOR_REVIEW → approve (checksum) → POSTING → POSTED via Posting Engine.

Idempotency key: `closev2:{tenant}:{closeRunId}:batch:{version}`. Prior unposted versions SUPERSEDED. Posted batch never overwritten.
