# Envelope Encryption

AES-256-GCM DEK + wrapped DEK under master key. AAD binds tenant/business/terminal/environment/type/reference.
Unique 12-byte nonce per encryption.

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
