# Encrypted Secret Storage

Tables: `MraEisEncryptedSecret`, `MraEisEphemeralSecret`, `MraEisCryptoKeyMeta`, `MraEisKeyRotationBatch`.
No plaintext columns. Not exposed via ordinary tenant CRUD.

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
