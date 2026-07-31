# Vault And KMS Integration

**Selected:** ENV_ENVELOPE (application envelope encryption).
**Rejected for day-1 on Laragon:** HashiCorp Vault / AWS KMS (no local infra).
**Upgrade path:** implement same interface against Vault Transit / cloud KMS; keep ciphertext schema.
Master key via env; never in DB; separate sandbox/prod keys via deployment env + credential environment AAD.

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
