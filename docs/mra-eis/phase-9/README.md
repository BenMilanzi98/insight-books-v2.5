# Phase 9 — MRA EIS Site, Tax, Levy & Payment Mapping

**Decision:** `READY_FOR_PHASE_10_WITH_BLOCKERS`

## Entry
- Services: `lib/mraEis/application/mapping/`
- Phase 5 CRUD reuse: `lib/mraEis/application/services/mappingService.js`
- Migration: `prisma/migrations/20260722270000_mra_eis_phase9_mappings`
- Tenant UI: `/settings/integrations/mra-eis/mappings`
- Admin UI: `/insightbooks/mra-eis/mappings`
- APIs: `/api/mra-eis/mappings/**`, `/api/admin/mra-eis/mappings`

## Lifecycle
Active MRA Configuration → Sites & external defs → Local masters → Suggestions → Verify → Approve (prod) → Activate (effective dates) → Completeness → Resolution services → Config change revalidation → Conflicts block fiscalization

## Hard rules
- Suggestions ≠ ACTIVE
- ACTIVE requires verification; production may require approval
- No overlapping active effective periods
- Revalidation never auto-remaps
- Local tax/levy/branches never auto-created from MRA
- Sandbox/production mappings isolated
- Product/Service mapping Phase 10 placeholders remain blockers for production fiscalization

---
*Phase 9 implementation. Suggestions never auto-activate. No Product/Service sync. No Sale submission. No fiscal numbers. No Journal/Stock mutations. Zero-rated ≠ exempt. VAT5 separate. Split payments fail-closed. Virtual Warehouse blocked pending MRA clarification.*
