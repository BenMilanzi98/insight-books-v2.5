# Phase 8 Handover — Configuration Synchronization

## Ready inputs from Phase 7
- Active terminal model + status machine
- Credential references (JWT + secret) via Secret Provider
- Activation-bootstrap configuration snapshots (global/terminal/taxpayer)
- MRA API client + mock
- Request hasher / canonicalizer (Phase 6)
- Environment registry / activation mode
- Product ID + version on terminal
- Outbox event `CONFIGURATION_SYNC_REQUESTED` after ACTIVE
- Sync Run model (Phase 5)
- Permissions / audit / health

## Phase 8 must implement
- Current configuration retrieval + BOD/scheduled/manual sync
- Version compare, activate, staleness, terminal pause
- Tax/levy/offline-threshold/receipt extraction
- Conflict handling, retry/backoff, unblock refresh
- Admin UI + monitoring + tests

## Blockers carried forward
- Q-017–019 SaaS identity (production)
- Confirmation signer sandbox verification for productionEnabled
- Live sandbox verification of activation/config contracts
- Q-010/Q-011 message hash if required on sync endpoints
- Q-016 recovery endpoint if MRA provides status poll

## Acceptance for Phase 8 start
Terminal can be ACTIVE in MOCK with encrypted credentials and bootstrap snapshots; config sync workers may consume outbox without re-implementing activation.

---
*Phase 7 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock mutations. TAC ephemeral. JWT/secret encrypted. ACTIVE only after confirmation.*
