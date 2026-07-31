# Inventory and Service Workflow Research

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

## Channel classification

| Operation | Portal | API | Back Office | InsightBooks role |
|---|---|---|---|---|
| Virtual Warehouse view | Yes (FAQ) | GET warehouse-inventory | — | Sync/reconcile display; not accounting authority |
| Initial Inventory upload | Yes | POST taxpayer-initial-inventory-upload (≤50/batch) | Approval | Optional assist; separate from Opening Stock GL |
| Product mapping / UNSPSC | — | product-status | Mapping | Pre-sale readiness |
| Site products/services sync | — | get-terminal-site-products (**POST** in OpenAPI; guide sample GET) | — | Sync catalogue |
| Informal purchases | Yes | submit-informal-purchase | Approval required | Integration later |
| Transfers W→Site / Site→Site | Yes | transfer-inventory | — | Bridge optional |
| Adjustments | — | submit-adjustment + reasons | — | Bridge optional |
| Raw materials / conversion | — | raw-material APIs | — | Manufacturing taxpayers |
| Services registration | Yes | via site products sync | Approval | Map local services |
| Stock after sale | MRA central control (guide) | Sales side-effect | — | Local stock must reconcile carefully |
| Void / credit impact on stock | Partially via cancel-receipt / credit-debit APIs | — | ${conf.RC} for full rules |

**Engineering conclusion:** API is not sole inventory authority; portal + back office dominate many workflows.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
