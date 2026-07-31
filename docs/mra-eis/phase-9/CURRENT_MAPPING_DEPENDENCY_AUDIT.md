# Current Mapping Dependency Audit

| Area | Finding | Classification |
|---|---|---|
| Tenant = Business | `businessId` aliases `tenantId` | REUSE |
| Branch | `Branch.tenantId`, no FK to site mappings | REUSE |
| Warehouse | Optional local model; no auto VW | EXTEND |
| TaxRate / PaymentMethod | Local masters if present | REUSE |
| Phase 5 Site/Tax/Levy/Payment mapping models | Present | REUSE |
| Phase 5 mappingService | Create + overlap checks | EXTEND |
| Phase 8 external tax/levy defs + sites | Active config extract | REUSE |
| Phase 8 revalidation Outbox events | Consumed by Phase 9 revalidation | REUSE |
| Product/Service mappings | Phase 5 models exist; sync Phase 10 | LEGACY_READ_ONLY / Phase 10 |
| EFD legacy external codes | Not auto-activated | MIGRATE (dry-run later) |
| Approval engine | Existing approvalId fields | REUSE |
| Audit | `recordEisControlAudit` | REUSE |

---
*Phase 9 implementation. Suggestions never auto-activate. No Product/Service sync. No Sale submission. No fiscal numbers. No Journal/Stock mutations. Zero-rated ≠ exempt. VAT5 separate. Split payments fail-closed. Virtual Warehouse blocked pending MRA clarification.*
