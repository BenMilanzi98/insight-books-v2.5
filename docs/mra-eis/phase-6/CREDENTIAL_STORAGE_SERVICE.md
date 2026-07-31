# Credential Storage Service

`storeSecret` encrypts, writes backing row, sets `vaultReference=env-envelope://v1/<id>`, rotates prior ACTIVE references.

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
