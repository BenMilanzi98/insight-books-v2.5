# Phase 18 Handover

Phase 18 owns unified EIS administration, monitoring and reporting UI.

## Available from Phase 17
- Restriction aggregate + Terminal Compliance Projection
- Unblock Requests + mock status classification
- Revalidation runs + gradual restoration stages
- Capability matrix / Effective Compliance Capability
- Emergency pause activate/clear
- Pending online/offline classification helpers
- Permissions: `eis.restrictions.*`, `eis.unblockRequests.*`, `system.eis.emergencyPause.*`
- API: `/api/mra-eis/restrictions`
- UI seed: `/settings/integrations/mra-eis/restrictions`

## Phase 18 must not weaken
- Multi-tenant isolation
- Restriction enforcement
- Credential security
- Fiscal-number integrity
- Snapshot / Response / Receipt immutability
- Accounting / Inventory isolation

## Phase 18 acceptance (summary)
- Unified System / Tenant / Business EIS dashboards
- Terminal / Site / Agent / Device fleets
- Transmission / Reconciliation / Offline / Receipt / Restriction monitoring
- Incident + Manual Review workbenches
- Report + export center
- Accessible, responsive role-based dashboards

---
*Phase 17 implementation. Restrictions are source/scope/environment-aware with immutable evidence. Multiple restrictions coexist; clearing one does not clear others. Most restrictive control wins. MRA blocks require verified MRA clearance. HTTP 200 alone is not clearance. Approval alone does not restore Terminal. Post-unblock revalidation is mandatory. Production unblock calls remain BLOCKED until contract verified. No credentials/JWT/private keys/BAC in evidence. No Journal/Stock repost. No fiscal-number reuse. No accepted Sale retransmission. Browser cannot set Terminal ACTIVE.*
