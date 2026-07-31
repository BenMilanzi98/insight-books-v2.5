# Cryptographic Boundary Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

| Service | Status |
|---|---|
| ActivationConfirmationSigner (HMAC-SHA512 TAC) | Ready for KAT unit tests |
| EisMessageHasher (x-eis-message-hash) | **BLOCKED** — interface only |
| OfflineTransactionSigner | **BLOCKED** until KAT |
| FiscalNumberEncoder | **BLOCKED** until examples reproduce |
| PayloadCanonicalizer | Conditional on hash rules |

No fake outputs for blocked algorithms.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
