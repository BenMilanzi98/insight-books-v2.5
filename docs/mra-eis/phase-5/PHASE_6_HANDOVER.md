# Phase 6 Handover — Credential Security & Crypto Interfaces

## Implemented for Phase 6 to consume
- `MraEisCredentialReference` (vaultReference, keyVersion, provider=PHASE6_VAULT)
- Terminal environment + status machine (no activation calls)
- Configuration snapshots (safe canonical JSON)
- Repository contracts / typed errors / audit hooks
- Data classification: SECRET fields prohibited from ordinary tables
- Synthetic fixtures without real secrets

## Phase 6 must implement
- Envelope encryption / vault integration / key rotation
- Secure decrypt boundaries
- TAC & buyer-auth ephemeral protection
- Payload canonicalization + message hashing (blocked on Phase 1 clarifications)
- Activation confirmation signing interfaces
- Offline signature crypto interfaces (certification-gated)
- Redaction + secret-access audit
- Known-answer tests + CI secret separation

## Do not start in Phase 6 until
- Phase 1 message-hash / fiscal Base64 KAT clarifications progress
- Vault provider selected
- No plaintext columns introduced as shortcuts

## Acceptance for Phase 6 entry
Phase 5 readiness **READY_FOR_PHASE_6_WITH_BLOCKERS** — crypto/activation/transmission workers remain out of scope until their phases.

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
