# Restriction Control Dependency Audit

| Control | Classification | Notes |
|---|---|---|
| `MraEisTerminal.status` / `blockedAt` | WRAP | Projection is authoritative for capabilities |
| Platform emergency pause (Phase 4) | EXTEND | Ingest as PLATFORM_EMERGENCY_PAUSE |
| Tenant entitlement suspend | EXTEND | TENANT_ENTITLEMENT_SUSPENDED |
| Business EIS pause | EXTEND | BUSINESS_EIS_PAUSED |
| Agent suspend/revoke (Phase 16) | EXTEND | OFFLINE_AGENT_SUSPENDED |
| Device compromise | EXTEND | OFFLINE_DEVICE_COMPROMISED |
| `eisService.checkTerminalStatus` fail-open | UNSAFE_AUTO_UNBLOCK → FIXED | Now fail-closed |
| Offline API client `terminalBlocked` | UNSAFE_DIRECT_OVERRIDE → FIXED | Ignored / rejected |
| Terminal BLOCKED→ACTIVE | UNSAFE_DIRECT_OVERRIDE → DISABLED | Throws |
| Phase 13/15/16 block signals | REUSE | Ingest into Restriction aggregate |
| Generic Audit / Approval / Outbox | REUSE | No duplicate generic systems |

---
*Phase 17 implementation. Restrictions are source/scope/environment-aware with immutable evidence. Multiple restrictions coexist; clearing one does not clear others. Most restrictive control wins. MRA blocks require verified MRA clearance. HTTP 200 alone is not clearance. Approval alone does not restore Terminal. Post-unblock revalidation is mandatory. Production unblock calls remain BLOCKED until contract verified. No credentials/JWT/private keys/BAC in evidence. No Journal/Stock repost. No fiscal-number reuse. No accepted Sale retransmission. Browser cannot set Terminal ACTIVE.*
