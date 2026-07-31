# Canonical Fiscalization Event

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

## Decision

Adapters emit **`EligibleSaleFinalized`** (alias of Phase 2 `SALE_FISCALIZATION_ELIGIBLE`) from:
- `PosSaleFinalized` (completed POS)
- `SalesInvoiceIssued` (non-Draft invoice after posting)

```
EligibleSaleFinalized {
  eventId, eventVersion, sourceType, sourceId, sourceVersion,
  tenantId, businessId, branchId?, transactionDate, postingDate,
  currency, customerId?, localDocumentNumber, journalEntryId,
  stockMovementIds[], total, taxTotal, paymentSummary,
  finalizedBy, finalizedAt, correlationId
}
```

No secrets, no MRA DTOs. Persisted via Outbox. Does not re-post accounting.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
