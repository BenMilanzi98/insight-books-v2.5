# Phase 18 — Unified EIS Administration Centre

**Decision:** `READY_FOR_PHASE_19_WITH_BLOCKERS`

## Entry
- Domain: `lib/mraEis/application/admin/`
- Tenant API: `/api/mra-eis/admin`
- Tenant UI: `/settings/integrations/mra-eis/centre`
- Platform UI: `/insightbooks/mra-eis/centre`
- Sidebar: MRA EIS Admin Centre (platform) + MRA EIS Centre (tenant Features)
- Tests: `test/mraEis.phase18.admin.test.js`
- Wraps: Phase 7–17 settings/workbench pages (deep links)

## Hard rules
- Not a second EIS processing engine
- Every status from server-side domain data
- Commands invoke domain services only
- Failed dashboard queries are not shown as zero
- Critical restrictions override health scores
- Export permission rechecked at request / generate / download
- Signed download URLs expire

---
*Phase 18 implementation. Operational window over Phases 1–17. No fiscal engine duplication. Server-authoritative Tenant/Business/Environment context. Failed queries ≠ zero. Stale data labelled. Commands are intent-only (no arbitrary final states). No Set Terminal Active / Mark Accepted / Clear MRA without evidence. No credentials/JWT/private keys/BAC in UI or exports. Saved views do not grant permissions. Scheduled/export permission rechecked. No Journal/Stock from Phase 18. No historical Sale submission.*
