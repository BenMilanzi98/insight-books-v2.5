# MRA EIS Data Dictionary

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

Core fields (extend during sandbox). Status: VERIFIED_OFFICIAL for OpenAPI types; meaning from guide where cited.

| JSON path | Natural name | Domain | Type | Required | Nullable | Max | Sensitive | Source | Status |
|---|---|---|---|---|---|---|---|---|---|
| terminalActivationCode | TAC | Activation | string | Y | N | 50 (guide) | SECRET | Guide+OAS | VO |
| environment.platform.macAddress | MAC | Environment | string | Conflict | Y OAS | 17 | INTERNAL | Guide/OAS | OI |
| environment.pos.productID | Product ID | Environment | string | Y | N | 50 | INTERNAL | Guide+OAS | VO |
| terminalCredentials.jwtToken | JWT | Credentials | string | — | Y | — | SECRET | OAS | VO |
| terminalCredentials.secretKey | Secret key | Credentials | string | — | Y | — | SECRET | OAS | VO |
| invoiceHeader.invoiceNumber | Fiscal invoice no. | Invoice header | string | Y | N | — | INTERNAL | OAS+Guide | OA |
| invoiceHeader.invoiceDateTime | Invoice timestamp | Invoice header | date-time | Y | N | — | INTERNAL | OAS | VO |
| invoiceHeader.sellerTIN | Seller TIN | Invoice header | string | Y | N | — | CONFIDENTIAL | OAS | VO |
| invoiceHeader.buyerTIN | Buyer TIN | Buyer | string | N | Y | — | CONFIDENTIAL | OAS | VO |
| invoiceHeader.buyerAuthorizationCode | Buyer auth code | Buyer | string | N | Y | — | SECRET | OAS | VO |
| invoiceHeader.siteId | Site ID | Site | string | Y | N | — | INTERNAL | OAS | VO |
| invoiceHeader.*ConfigVersion | Config versions | Configuration | int32 | Y | N | — | INTERNAL | OAS | VO |
| invoiceHeader.isReliefSupply | Relief flag | VAT5 | boolean | N | — | — | INTERNAL | OAS | VO |
| invoiceHeader.paymentMethod | Payment method | Payment | string | N | Y | — | INTERNAL | OAS | OA |
| invoiceLineItems[].productCode | Product code | Product | string | N OAS | Y | — | INTERNAL | OAS | OA |
| invoiceLineItems[].unitPrice | Unit price | Invoice line | double | — | — | — | INTERNAL | OAS | OA |
| invoiceLineItems[].isProduct | Product/service flag | Invoice line | boolean | — | — | — | INTERNAL | OAS | OA |
| invoiceSummary.taxBreakDown | Tax breakdown | Tax | array | Y | N | — | INTERNAL | OAS | VO |
| invoiceSummary.offlineSignature | Offline signature | Offline | string | N | Y | — | SECRET-ish | OAS | VO |
| invoiceSummary.invoiceTotal | Invoice total | Invoice summary | double | N | — | — | INTERNAL | OAS | OA |
| data.validationURL | Validation URL | Response | string | — | Y | — | INTERNAL | OAS | VO |
| data.shouldBlockTerminal | Block flag | Blocking | boolean | — | — | — | INTERNAL | OAS | VO |
| data.shouldDownloadLatestConfig | Config refresh | Configuration | boolean | — | — | — | INTERNAL | OAS | VO |
| errors[].errorCode | Error code | Error | int | — | — | — | INTERNAL | OAS | VO |

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
