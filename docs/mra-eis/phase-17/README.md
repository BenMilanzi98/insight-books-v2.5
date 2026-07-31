# Phase 17 — Terminal Blocking, Unblocking & Compliance Controls

**Decision:** `READY_FOR_PHASE_18_WITH_BLOCKERS`

## Entry
- Domain: `lib/mraEis/application/restrictions/`
- APIs: `/api/mra-eis/restrictions`
- UI: `/settings/integrations/mra-eis/restrictions`
- Models: `MraEisRestriction`, `MraEisUnblockRequest`, `MraEisUnblockStatusQueryAttempt`, `MraEisPostUnblockRevalidationRun`
- Migration: `prisma/migrations/20260723040000_mra_eis_phase17_restrictions`
- Tests: `test/mraEis.phase17.restrictions.test.js`
- Legacy wrap: `lib/eisService.js` fail-closed status; Terminal `BLOCKED→ACTIVE` forbidden

## Hard rules
- Not a single `blocked` Boolean — multi-source Restriction aggregate
- MRA clearance requires verified application outcome (not HTTP 200)
- Tenant users cannot clear MRA restrictions
- Browser cannot set Terminal ACTIVE
- Post-unblock revalidation mandatory; remaining restrictions rechecked
- Gradual capability restoration
- Preserve Snapshots, numbers, Attempts, Responses, envelopes, queues, receipts
- No accounting / inventory reverse or repost

---
*Phase 17 implementation. Restrictions are source/scope/environment-aware with immutable evidence. Multiple restrictions coexist; clearing one does not clear others. Most restrictive control wins. MRA blocks require verified MRA clearance. HTTP 200 alone is not clearance. Approval alone does not restore Terminal. Post-unblock revalidation is mandatory. Production unblock calls remain BLOCKED until contract verified. No credentials/JWT/private keys/BAC in evidence. No Journal/Stock repost. No fiscal-number reuse. No accepted Sale retransmission. Browser cannot set Terminal ACTIVE.*
