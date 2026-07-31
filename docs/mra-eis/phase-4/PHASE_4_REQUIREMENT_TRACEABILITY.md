# Phase 4 Requirement Traceability

| Requirement | Evidence | Implementation |
|---|---|---|
| Two-level entitlement | Phase 3 EIS_ENTITLEMENT_ARCHITECTURE | MraEisTenantEntitlement + Participation + BusinessSetting |
| Effective capability | Phase 3 ADR + handover | lib/mraEis/policies/effectiveCapability.js |
| Platform kill switch | Phase 3 | MraEisPlatformSetting |
| No self-entitle | Phase 3/4 rules | Admin-only grant APIs |
| Sandbox ≠ production | Phase 3 | productionAllowed flag + policy |
| History retained | Phase 3 | Soft status changes; no deletes |
| No MRA I/O | Phase 4 boundary | No client in lib/mraEis |
| Fix hasEISAccess | Phase 2 G2-004 | subscriptionService.js |
| Gate legacy submit | Phase 2/4 | canSubmitEISInvoice + sales/invoices/quotations |

---
*Phase 4 implementation. No MRA API calls from entitlement actions. No terminals activated. No posted Journals modified.*
