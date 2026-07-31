# EIS-Relevant Database Model Inventory

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

## Tenancy

| Model | Tenant key | Notes | EIS suitability |
|---|---|---|---|
| Tenant | id | = Business; tpin, eisEnabled | Config root |
| Branch | tenantId | Multi-branch | Map to siteId |
| TenantMembership | tenantId | Multi-business users | |
| InventoryLocation | tenantId | Local warehouse analog | Not MRA VW |

## Sales

| Model | Notes | Phase 3 |
|---|---|---|
| Sale / SaleItem / SaleItemTax | POS; paymentMethod string; Float money | Snapshot source |
| Invoice / lines | status Draft vs issued | Snapshot source |
| Payment / PaymentAllocation | Split pay | Map paymentMethod |
| CreditNote / InvoiceRefund | Corrections | MRA credit/void |

## Accounting V2

| Model | Notes |
|---|---|
| AcctV2EventRegistry | Unique idempotencyKey |
| AcctV2Journal / lines | Source links |
| AcctV2Outbox | Written; **not drained** |
| AcctV2FeatureFlag | Not used for EIS |

## Existing EIS

| Model | Suitability |
|---|---|
| EISInvoice | REUSABLE_WITH_CHANGES — status model incomplete vs Phase 1 |
| EISConfiguration | UNSAFE — OAuth-era fields; settings JSON may hold plaintext token |
| EISSubmissionLog | REUSE — redact secrets |
| EISUsage | REUSE for quota telemetry |

Money fields often `Float` — Phase 3 should prefer decimal types for fiscal snapshots.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
