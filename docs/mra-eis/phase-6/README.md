# Phase 6 — Credential Security & Cryptographic Foundation

**Decision:** `READY_FOR_PHASE_7_WITH_BLOCKERS` (see PHASE_6_READINESS_DECISION.md)

## Entry
- Server module: `lib/mraEis/security.js`
- Implementation: `lib/mraEis/infrastructure/security/`
- Migration: `prisma/migrations/20260722240000_mra_eis_phase6_security`
- Admin APIs: `/api/admin/mra-eis/security/health`, `/api/admin/mra-eis/security/credentials/[id]`

## Provider
**ENV_ENVELOPE** — AES-256-GCM envelope encryption with master key from `MRA_EIS_MASTER_KEY_v1` (not stored in DB). Vault/KMS-shaped interface ready for future swap.

## Crypto status
| Capability | Status |
|---|---|
| Envelope encryption | VERIFIED (internal) |
| Activation HMAC-SHA512 | VERIFIED_WITH_TEST_VECTOR (KAT); production disabled |
| Message hash | BLOCKED (Q-010/Q-011) |
| Offline signing | BLOCKED (Q-040 + certification) |
| Fiscal encoding | BLOCKED (Q-021) |

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
