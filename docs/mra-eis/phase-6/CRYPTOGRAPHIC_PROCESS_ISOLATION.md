# Cryptographic Process Isolation

**Selected:** in-process Node crypto within API/worker with service-identity gates.
**Rejected day-1:** separate crypto microservice (ops cost).
**Future:** KMS/Vault Transit so app never holds long-lived terminal secret.

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
