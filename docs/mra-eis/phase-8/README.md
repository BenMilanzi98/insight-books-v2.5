# Phase 8 — MRA Configuration Synchronization

**Decision:** `READY_FOR_PHASE_9_WITH_BLOCKERS`

## Entry
- Services: `lib/mraEis/application/configuration/`
- Mock: `lib/mraEis/infrastructure/mraClient/mockMraConfigurationServer.js`
- Client: `configurationClient.js`
- Migration: `prisma/migrations/20260722260000_mra_eis_phase8_configuration_sync`
- Tenant UI: `/settings/integrations/mra-eis/terminals/[id]/configuration`
- Admin UI: `/insightbooks/mra-eis/configuration`
- APIs: `/api/mra-eis/terminals/[id]/configuration`, `.../sync`, `/api/admin/mra-eis/configuration`, BOD job

## Sync order
GLOBAL → TERMINAL → TAXPAYER → extract → validate set → atomic activate → mapping revalidation Outbox events

## Hard rules
- Immutable snapshots (Phase 5 store)
- Same version + different checksum → CONFLICT
- Atomic required-set activation
- Stale → pause new fiscal processing (read/recon/sync remain)
- Request hash Q-010/Q-011 fail-closed outside MOCK
- Production sync blocked until gates clear
- Offline thresholds extracted but offline stays disabled
- Local tax rates never auto-modified

---
*Phase 8 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock/local-tax mutations. Snapshots immutable. Activation atomic. Offline remains disabled.*
