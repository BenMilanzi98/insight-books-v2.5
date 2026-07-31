# Phase 7 Handover — Terminal Activation

## Consume from Phase 6
- `storeSecret` / `withSecret` / `storeEphemeralSecret` / `withEphemeralSecret`
- `signActivationConfirmation` (sandbox/KAT only until sandbox-verified)
- `hashEisMessage` / `signOfflineTransaction` remain blocked
- Crypto registry statuses
- Redaction + audit + permissions
- Admin metadata APIs

## Phase 7 must implement
- Setup wizard, TAC entry (POST body only), activation request construction
- Persist JWT+secret via `storeSecret` after activation response
- Confirmation using signer + ephemeral TAC
- Timeout/retry/reactivation UX
- Still no sales transmission

## Blockers carried in
- Q-010/Q-011 message-hash
- Q-016 activation timeout recovery
- Q-017–019 SaaS terminal identity
- Q-040 offline
- Sandbox verification of activation HMAC

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
