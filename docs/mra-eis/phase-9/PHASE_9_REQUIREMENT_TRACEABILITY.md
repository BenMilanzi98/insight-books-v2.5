# Phase 9 Requirement Traceability

| Requirement | Evidence / Implementation |
|---|---|
| Mapping type registry | `mappingTypeRegistry.js` |
| Status model | `MAPPING_STATUS` in operationalEnums |
| Readiness | `mappingReadiness.js` |
| Taxpayer identity | `businessTaxpayerIdentity.js` |
| Site catalogue | `siteCatalogue.js` |
| Branch-site mapping | Phase 5 `createSiteMapping` + lifecycle |
| Tax treatments | `taxTreatment.js` |
| Split payment fail-closed | `splitPaymentPolicy.js` |
| Resolution | `resolutionServices.js` |
| Completeness | `mappingCompleteness.js` |
| Revalidation | `mappingRevalidation.js` |
| Snapshot contract | `buildResolvedMappingSnapshot` |
| APIs | `app/api/mra-eis/mappings/**` |
| UI | tenant mappings page + admin health |
| Migration | `prisma/migrations/20260722270000_mra_eis_phase9_mappings` |

---
*Phase 9 implementation. Suggestions never auto-activate. No Product/Service sync. No Sale submission. No fiscal numbers. No Journal/Stock mutations. Zero-rated ≠ exempt. VAT5 separate. Split payments fail-closed. Virtual Warehouse blocked pending MRA clarification.*
