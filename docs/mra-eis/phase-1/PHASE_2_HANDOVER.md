# Phase 2 Handover Requirements

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

Phase 2 audits InsightBooks internals against MRA requirements. Locate:

| MRA need | IB component to inspect |
|---|---|
| Tenant/Business/Branch | prisma Tenant, Branch, settings |
| Warehouse/products | Inventory models |
| Tax | malawiTaxCatalog, tax fields |
| POS / Invoice | app/pos, invoices APIs |
| Receipts/QR | PrintableReceipt, verify page |
| Payments | payment methods |
| Posting Engine / Journals | accountingV2 |
| Outbox/Jobs | background jobs audit |
| Entitlements/flags | subscription, tenantPageAccess |
| RBAC / Approvals / Audit | security-governance |
| Secrets/encryption | lib/encryption, secret mgmt docs |
| Existing EIS | lib/eis*, app/api/eis*, EIS* prisma models |
| EFD legacy | search EFD |

External contract pack = this Phase 1 folder + docs/mra-eis parent snapshots.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
