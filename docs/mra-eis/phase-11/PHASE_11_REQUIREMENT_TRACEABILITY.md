# Phase 11 Requirement Traceability

| Requirement | Implementation |
|---|---|
| Qualifying types | `salesTransactionTypeRegistry.js` |
| Applicability | `eisApplicability.js` |
| Go-live | `eisGoLiveAt` on `MraEisBusinessSetting` |
| Policy registry | `eligibilityPolicyRegistry.js` |
| Pipeline stages 1–10 | `eligibilityPipeline.js` |
| Buyer/B2B/VAT5 | `buyerAndVat5.js` |
| Totals/currency | `totalsAndCurrency.js` |
| Terminal/site | `terminalAndLocation.js` + Phase 8/9 services |
| Product/Service | Phase 10 resolution |
| Tax/Levy/Payment | Phase 9 resolution |
| Bridge + outbox | `salesBridgeService.js` |
| Preflight | `preflightEligibility.js` |
| POS/Invoice hooks | `finalizationIntegration.js` |
| Reconciliation | `missedBridgeReconciliation.js` |
| Status/messages | `statusAndMessaging.js` |

---
*Phase 11 implementation. Local sales eligibility + bridge only. No MRA Sale submission, fiscal number, QR, or “MRA validated” receipt. Bridge creates no Journal/Stock Movement. Customer payments are not Sales. Draft/Quote/Proforma excluded.*
