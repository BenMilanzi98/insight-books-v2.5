# Phase 5 Requirement Traceability

| Requirement | Architectural source | Implementation |
|---|---|---|
| Terminal aggregate | Phase 3 Terminal Aggregate Design | `MraEisTerminal` + `terminalService.js` |
| Terminal state machine | Phase 3 / master §11 | `operationalStateMachines.js` |
| Credential references (no plaintext) | Phase 3 / Phase 6 handover | `MraEisCredentialReference.vaultReference` |
| Config snapshots immutable | Phase 3 Config Aggregate | `MraEisConfigurationSnapshot` + `configurationService.js` |
| Activation history append-only | Phase 3 | `MraEisConfigurationActivation` |
| Site + branch mapping | Phase 3 Mapping Architectures | `MraEisSite` / `MraEisSiteMapping` |
| External catalogue | Phase 3 | `MraEisExternalCatalogueItem` |
| Product/tax/levy/payment mappings | Phase 3 | Mapping models + `mappingService.js` |
| Fiscal sequence concurrency | Phase 3 Fiscal Numbering | `fiscalSequenceService.js` FOR UPDATE |
| Immutable fiscal snapshot | Phase 3 Snapshot Architecture | `MraEisSnapshot` + queue immutability |
| Transmission + attempts + responses | Phase 3 Transmission Aggregate | transmission services + models |
| Receipt projection rebuildable | Phase 3 Read Models | `MraEisReceiptProjection` |
| VAT5 foundation | Phase 3 / contract | `MraEisVat5Validation` + `vat5Service.js` |
| Offline gated | Phase 3 Offline Queue | `offlineQueueService.js` |
| Reconciliation no accounting | Phase 3 | `reconciliationService.js` |
| Outbox foundation | Phase 2/3 Outbox Audit | `MraEisOutbox` + `outboxService.js` |
| Multi-tenant = Business | Phase 2 hierarchy | `assertTenantBusinessMatch` |
| Phase 4 capability gate | Phase 4 handover | draft terminal uses entitlement check |

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
