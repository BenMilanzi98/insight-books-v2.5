# Sales Transaction Contract

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

`POST /api/v1/sales/submit-sales-transaction` body SalesInvoice

## Header required (OpenAPI)

invoiceNumber, invoiceDateTime, sellerTIN, siteId, globalConfigVersion, taxpayerConfigVersion, terminalConfigVersion

## Header optional

buyerTIN, buyerName, buyerAuthorizationCode, isExport, isReliefSupply, vat5CertificateDetails, paymentMethod

## Lines

id, productCode, description, unitPrice, quantity, discount, total, totalVAT, taxRateId, isProduct — OpenAPI has no required[] on LineItemDto (guide may mandate).

## Summary

taxBreakDown required; levyBreakDown, totalVAT, offlineSignature, invoiceTotal, amountTendered optional in schema.

## Math

Exact formulas/rounding: **RC** — block payload implementation until clarified + sandbox examples. Do not use IEEE float for money in later phases.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
