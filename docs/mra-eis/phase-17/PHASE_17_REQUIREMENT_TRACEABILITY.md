# Phase 17 Requirement Traceability

| Requirement | Trace |
|---|---|
| Source-aware restrictions | `restrictionRegistries.js` + `ingestRestriction` |
| Scope / environment | Restriction fields + projection |
| Precedence | `PRECEDENCE_ORDER` / `pickPrimaryRestriction` |
| Capability policy | `capabilityMatrix.js` + `effectiveComplianceCapability.js` |
| Immutable evidence | `evidenceJson` + checksum; secrets stripped |
| Unblock workflow | `unblockService.js` |
| Mock status | `mockMraBlockUnblockServer.js` |
| Revalidation | `revalidationService.js` |
| Workers | `restrictionWorkers.js` |
| Fail-closed legacy | `lib/eisService.js` checkTerminalStatus |
| Direct ACTIVE forbidden | `terminalService.js` |

---
*Phase 17 implementation. Restrictions are source/scope/environment-aware with immutable evidence. Multiple restrictions coexist; clearing one does not clear others. Most restrictive control wins. MRA blocks require verified MRA clearance. HTTP 200 alone is not clearance. Approval alone does not restore Terminal. Post-unblock revalidation is mandatory. Production unblock calls remain BLOCKED until contract verified. No credentials/JWT/private keys/BAC in evidence. No Journal/Stock repost. No fiscal-number reuse. No accepted Sale retransmission. Browser cannot set Terminal ACTIVE.*
