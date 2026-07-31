# Phase 7 — Terminal Onboarding & Activation

**Decision:** `READY_FOR_PHASE_8_WITH_BLOCKERS` (see PHASE_7_READINESS_DECISION.md)

## Entry points
- Domain services: `lib/mraEis/application/activation/`
- Mock MRA: `lib/mraEis/infrastructure/mraClient/mockMraActivationServer.js`
- Activation client: `lib/mraEis/infrastructure/mraClient/activationClient.js`
- Migration: `prisma/migrations/20260722250000_mra_eis_phase7_activation`
- Tenant APIs: `/api/mra-eis/terminals/**`
- Admin API: `/api/admin/mra-eis/terminals`
- Tenant UI: `/settings/integrations/mra-eis/terminals`
- Admin UI: `/insightbooks/mra-eis/terminals`

## Lifecycle (success)
DRAFT → TAC_REQUIRED → ACTIVATION_REQUEST_PENDING → ACTIVATION_IN_PROGRESS → ACTIVATION_RESPONSE_RECEIVED → CREDENTIALS_PERSISTED → CONFIRMATION_PENDING → CONFIRMATION_IN_PROGRESS → **ACTIVE**

ACTIVE is never set from HTTP 200 alone or from credential possession alone.

## Modes
MOCK (default for tests) · SANDBOX · CERTIFICATION · PRODUCTION (create/activate blocked until SaaS identity + signer productionEnabled)

## Hard rules enforced
- TAC in POST body only; ephemeral store; not logged; destroyed after confirmation
- JWT + terminal secret encrypted via Phase 6 Secret Provider
- Credentials never returned to browser (`safeTerminalDto`)
- Unknown outcomes → MANUAL_REVIEW / UNKNOWN_* ; no blind retry
- Production identity blocked (Q-017–019)

---
*Phase 7 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock mutations. TAC ephemeral. JWT/secret encrypted. ACTIVE only after confirmation.*
