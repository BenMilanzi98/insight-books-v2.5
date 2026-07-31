# Data Integrity Risk Register

| ID | Risk | Severity | Classification |
|----|------|----------|----------------|
| DIR-01 | Float vs Decimal money mix (PO/payment vs bill) | High | Rounding drift |
| DIR-02 | Supplier `currentBalance` denormalised | High | Diverges from AP |
| DIR-03 | No unique supplier invoice per supplier/tenant | High | Duplicate invoices |
| DIR-04 | Global unique bill/payment numbers | Medium | Cross-tenant collisions |
| DIR-05 | Global unique supplierCode | Medium | Tenant isolation friction |
| DIR-06 | Free-string statuses | Medium | Invalid transitions |
| DIR-07 | Optional PO on GR | Medium | Orphan receipts / weak match |
| DIR-08 | Bill lines lack GR/PO line FKs | High | Broken traceability |
| DIR-09 | No version/optimistic concurrency on posted docs | High | Lost updates / silent edits |
| DIR-10 | Hard delete suppliers/docs | High | History loss if allowed |

## Required DB work (phase 0–2)

1. Tenant-scoped codes/numbers  
2. `(tenantId, supplierId, supplierInvoiceNumber)` unique where invoice present  
3. Line FKs + match result table  
4. Idempotency unique indexes  
5. Decimal normalisation plan for money fields  
