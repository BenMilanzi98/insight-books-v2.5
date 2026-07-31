# Phase 6 Security Gap Register

| ID | Finding | Severity | Resolution |
|---|---|---|---|
| G6-001 | No SecretProvider | BLOCKER | Implemented ENV_ENVELOPE provider |
| G6-002 | No ciphertext store | BLOCKER | `MraEisEncryptedSecret` |
| G6-003 | CBC without AEAD | HIGH | Phase 6 uses AES-GCM; legacy retained read-path only |
| G6-004 | Message-hash unverified | BLOCKER (crypto) | Fail-closed hasher |
| G6-005 | Offline KAT missing | BLOCKER (crypto) | Fail-closed offline signer |
| G6-006 | Production activation signer | HIGH | productionEnabled=false until sandbox |
| G6-007 | Committed secrets in git | CRITICAL (ops) | Documented; rotate outside Phase 6 code |
| G6-008 | Backup dumps unencrypted | HIGH | Documented policy; encrypt before prod secrets |
| G6-009 | Real KMS/Vault absent | MEDIUM | Interface ready; ENV_ENVELOPE transitional |

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
