# Duplicate Reversal Risk Register

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R-DR01 | Concurrent document reverse creates two children | Critical | Unique (tenantId, sourceType, sourceId) on TransactionReversal + transactional lock |
| R-DR02 | reverseSourceJournals auto-grants journal.reverse | High | Require real permission; stop force-true |
| R-DR03 | V2 path already idempotent via event registry | Controlled | KEEP |
| R-DR04 | List API double-counts if both child flag and journal reverse listed | Medium | Register projection in Wave 2 |
