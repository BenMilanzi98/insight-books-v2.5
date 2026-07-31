# Cryptographic Dependency Review

| Package | Purpose | Notes |
|---|---|---|
| Node `crypto` | AES-GCM, HMAC, SHA-256, randomBytes, timingSafeEqual | Platform-native; preferred |
| `lib/encryption.js` CBC | Legacy EIS only | Do not use for Phase 6 credentials |
| jsonwebtoken / bcrypt | App auth | Not used for MRA terminal secrets |

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
