# Master Key Rotation

`rewrapSecretsBatch` unwraps DEK with old master, rewraps with new, idempotent cursor batches, dry-run supported. No plaintext export.

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
