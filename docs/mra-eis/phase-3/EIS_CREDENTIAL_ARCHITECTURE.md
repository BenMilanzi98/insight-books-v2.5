# EIS Credential Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Vault interface: `store / getForTransmission / rotate / revoke`.

Store JWT + secretKey via envelope encryption (extend `lib/encryption.js`; prefer AES-GCM later). References on Terminal; ciphertext in credential store.

Never: browser, API responses, logs, audit plaintext, outbox/queue payloads, snapshots, reports.

Migrate away from OAuth `clientId/clientSecret` and **plaintext `EISConfiguration.settings.token`** (Phase 2 blocker).

TAC / buyer auth codes: short TTL, never logged.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
