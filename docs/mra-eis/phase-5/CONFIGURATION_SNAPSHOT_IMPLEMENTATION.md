# Configuration Snapshot

`MraEisConfigurationSnapshot` immutable history.
Idempotent on (terminalId, type, mraVersion) + checksum.
Conflict on same version/different checksum.
Activation via `activateConfigurationSnapshot` (transactional supersede + activation history + terminal active refs).

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
