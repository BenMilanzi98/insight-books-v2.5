# Phase 8 Requirement Traceability

| Requirement | Implementation |
|---|---|
| Config types GLOBAL/TERMINAL/TAXPAYER | `configurationTypeRegistry.js` |
| Sync readiness | `syncReadinessService.js` |
| Sync Run + claim | `configurationSyncOrchestrator.js` + schema |
| Immutable snapshots | Phase 5 `storeConfigurationSnapshot` |
| Version/checksum conflict | `compareConfigurationVersions` + store |
| Atomic activation | orchestrator tx + `activateConfigurationSnapshot` |
| Tax/levy/offline/receipt extract | `configExtractors.js` |
| Staleness + pause | `stalenessService.js` |
| BOD | `bodScheduler.js` |
| Mapping hooks | Outbox mapping revalidation events |
| Mock server | `mockMraConfigurationServer.js` |

---
*Phase 8 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock/local-tax mutations. Snapshots immutable. Activation atomic. Offline remains disabled.*
