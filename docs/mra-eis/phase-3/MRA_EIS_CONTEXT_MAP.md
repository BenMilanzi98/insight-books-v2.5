# MRA EIS Context Map

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

| Upstream | Downstream | Exchange | Boundary |
|---|---|---|---|
| System Admin / Subscriptions | MraEis | Entitlement commands | Platform API |
| Tenant settings | MraEis | Operational enable/pause | Policy service |
| AuthN/AuthZ / SecV2 | MraEis | Actor, permissions, approvals | Shared |
| POS | MraEis | PosSaleFinalized → EligibleSaleFinalized | Adapter |
| Invoices | MraEis | SalesInvoiceIssued → EligibleSaleFinalized | Adapter |
| Accounting V2 | MraEis | journalEntryId, period | Reference only |
| Inventory | MraEis | stockMovementIds | Reference only |
| Tax Engine | MraEis | Stored tax on sale → mapping | Snapshot freeze |
| Customers | MraEis | Buyer fields at finalize | Snapshot freeze |
| Products | MraEis | Mapping resolution | Versioned map |
| Outbox/Workers | MraEis | EIS_* events | Infra |
| Receipt/PDF/Email | MraEis | Query receipt projection | Read |
| MRA API | MraEis client | HTTP | Server-only |

Dependency rule: operational modules emit events; MraEis consumes; receipt UI queries; MraEis never posts GL.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
