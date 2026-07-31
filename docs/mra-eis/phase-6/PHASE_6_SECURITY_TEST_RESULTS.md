# Phase 6 Security Test Results

```
npx vitest run test/mraEis.phase6.security.test.js
Test Files  1 passed (1)
Tests       12 passed (12)
```

Covers: envelope encrypt/decrypt, AAD tamper, activation KAT, blocked message-hash/offline, canonicalization, encoding, constant-time, redaction, server-only, schema hygiene.

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
