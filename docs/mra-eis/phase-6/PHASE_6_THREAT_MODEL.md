# Phase 6 Threat Model

Threats covered: DB/backup theft (ciphertext+need master), cross-tenant ciphertext move (AAD), nonce reuse (random IV), secret logging (redaction), browser exposure (server-only), algorithm downgrade (registry), TAC replay (one-time ephemeral), env confusion (AAD+checks). Residual: master key compromise → emergency rotate + rewrap.

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
