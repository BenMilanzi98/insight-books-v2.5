# Phase 16 — Certified Offline MRA EIS Mode

**Decision:** `READY_FOR_PHASE_17_WITH_BLOCKERS`

## Entry
- Domain: `lib/mraEis/application/offline/`
- APIs: `/api/mra-eis/offline`
- UI: `/settings/integrations/mra-eis/offline`
- Models: `MraEisTrustedAgent`, `MraEisOfflineFiscalEnvelope`
- Migration: `prisma/migrations/20260723030000_mra_eis_phase16_offline`
- Tests: `test/mraEis.phase16.offline.test.js`
- Reuses: `MraEisOfflineQueueEntry`, Phase 12 sequences, Phase 14 receipt wording hooks, Phase 15 unknown-outcome recon

## Hard rules
- Offline disabled by default; not enabled by network loss alone
- Production offline **BLOCKED** without CERTIFIED_PRODUCTION
- Browser-only fiscal signing / localStorage / IndexedDB **PROHIBITED**
- Private keys never in browser JS; online JWT ≠ signing key
- Atomic offline numbers; no MAX+1; no reuse; no backward move
- Sealed envelopes/queue items immutable
- Pending receipts do not claim MRA acceptance
- Unknown upload → Phase 15 reconcile (no blind retry)
- Upload creates no Journal / Stock Movement
- Terminal blocks stop new offline Sales

---
*Phase 16 implementation. Offline mode is disabled by default. Production requires CERTIFIED_PRODUCTION + verified contracts. Browser-only authoritative fiscal signing/storage is prohibited. navigator.onLine / localStorage / IndexedDB are not certified offline. One network failure does not enable offline. Sealed envelopes and queue items are immutable. Upload never reposts Journal/Stock. Unknown uploads require Phase 15 reconciliation. Maintenance does not auto-enable offline. No credentials/JWT/private keys/BAC in evidence.*
