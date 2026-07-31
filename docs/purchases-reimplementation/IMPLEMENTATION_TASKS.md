# Implementation Tasks

Checklist derived from audit + master prompt §65. Mark `[x]` only with evidence.

## A. Audit (complete)

- [x] Routes / UI inventory  
- [x] APIs inventory  
- [x] Database model audit  
- [x] Supplier / PO / GR / Bill / Payment audits  
- [x] Accounting + inventory posting audits  
- [x] Three-way matching audit  
- [x] Risk registers (duplicate, integrity, multi-tenant)  
- [x] Permissions / reports / tests audits  
- [x] Final gap register  
- [x] Reimplementation plan + posting matrix  

## B. Phase 0 — Foundations

- [x] GRNI CoA purpose + blueprint 2115 + legacy code  
- [x] Feature flag `purchasesGrniV2Enabled` (default ON)  
- [x] Unit tests for GRNI policy helpers  
- [x] Schema migration: match FKs, idempotency, inspection qtys  
- [ ] Tenant-scoped numbering plan  
- [x] Duplicate supplier invoice detection (API)  
- [x] PO no-post regression tests  

## C. Phase 1 — Receipt stock

- [x] Per-line FIFO source identity  
- [x] Accepted qty stock (rejected skipped)  
- [ ] Partial + over-receipt policy  
- [ ] Atomic post transaction hardening  
- [ ] Reversal command  

## D. Phase 2 — GRNI

- [x] Template Cr GRNI (default ON)  
- [x] Auto-bill journal decoupling  
- [x] Feature flag default ON  
- [x] Bills never create stock (finalizeInventoryBill)  
- [ ] Historical repair strategy  
- [ ] Integration test: receipt credits 2115; bill clears GRNI  

## E. Phase 3 — Bills + match

- [x] Matching service + tolerances (`threeWayMatching.js`)  
- [x] Match API `POST /api/purchases/bills/match`  
- [ ] Bill SM commands  
- [x] Inventory bill clears GRNI (template + finalize)  
- [x] Duplicate invoice detection  
- [x] No stock on bill (code path removed)  

## F. Phase 4 — Payments

- [ ] Allocation constraints  
- [ ] Idempotency  
- [ ] Settlement-only accounting tests  

## G. Phase 5 — Returns / credits

- [ ] Supplier return  
- [ ] Supplier credit note  

## H. Phase 6 — UI

- [ ] Suppliers / Orders / Receipts / Bills / Payments  
- [ ] Dashboard correct metrics  
- [ ] Matching UI  

## I. Phase 7–8 — Reports, recon, security, full tests, readiness

- [ ] Reconciliation centre  
- [ ] Reports drill-down  
- [ ] Permissions + SoD  
- [ ] Full automated matrix  
- [ ] Final readiness decision  

## Next concrete coding task

**B2:** Prisma EXTEND for bill/GR line match FKs + idempotencyKey; PO no-post regression test; enable GRNI flag on a pilot tenant after ensuring 2115 + purpose mapping.
