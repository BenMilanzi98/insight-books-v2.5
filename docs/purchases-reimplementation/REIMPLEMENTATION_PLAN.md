# Purchases Reimplementation Plan

## Principle

**Accounting and inventory correctness before UI polish.**  
Audit pack complete (2026-07-25). Implementation follows master prompt §65 order, compressed into delivery phases.

---

## Phase 0 — Foundations (schema & CoA)

1. Add/ensure CoA purpose + account: **GRNI / Accrued Purchases**.  
2. Prisma EXTEND (non-breaking where possible):  
   - matching fields, line FKs, idempotencyKey, inspection qtys, warehouse/branch, version  
   - tenant-scoped unique for supplierCode / billNumber / paymentNumber (migration plan)  
   - unique supplier invoice  
3. Document numbering service (no MAX+1).  
4. Guard tests: PO creates no JE / no stock.

**Exit:** Migration applies; GRNI account resolvable; PO guard tests green.

---

## Phase 1 — Receipt stock hardening

1. Line-level unique stock identity.  
2. Accepted vs rejected/damaged; rejected not available.  
3. Partial receipt qty rules + over-receipt policy.  
4. Transaction boundary: stock + GRNI JE + PO qty + audit atomic.  
5. Receipt reversal command.

**Exit:** Scenarios 2, 5 green; no duplicate stock on retry.

---

## Phase 2 — True GRNI cutover

1. Change `INVENTORY_PURCHASE` template → Cr GRNI.  
2. Data repair plan for historical AP-at-receipt (script + tenant flag; do not silent rewrite).  
3. Decouple auto-bill from sharing GR journal as bill JE.  
4. GRNI reconciliation report stub.

**Exit:** New receipts post GRNI; Scenario 2 GL asserts GRNI not AP.

---

## Phase 3 — Bills + three-way match

1. Match service + tolerances + statuses.  
2. Bill state machine commands.  
3. Inventory bill template: clear GRNI, VAT, PPV; **no stock**.  
4. Service/expense/asset bill paths.  
5. Duplicate supplier invoice block.  
6. Partial billing rules.

**Exit:** Scenarios 3, 6, 7, 9 green.

---

## Phase 4 — Payments

1. Allocation uniqueness + partial/multi-bill.  
2. Idempotency keys.  
3. Payment SM + approval hooks.  
4. WHT/FX (if CoA ready).  
5. Assert no expense/inventory on payment.

**Exit:** Scenario 4 green.

---

## Phase 5 — Returns & credits

Supplier return + credit note workflows; stock once; AP once.

---

## Phase 6 — UI (after posting correct)

1. Suppliers detail tabs + duplicate detection UI.  
2. Orders commitment metrics.  
3. Receipts inspection/posting preview.  
4. Bills matching panel.  
5. Payments allocation.  
6. Dashboard cards with correct labels.  
7. Responsive/a11y pass.

---

## Phase 7 — Reports, reconciliation, docs, notifications

Reconciliation centre checks; exports; PDFs; audit events; notifications.

---

## Phase 8 — Hardening

Full test matrix §63–64; security; multi-tenant; performance; production build; defect burn-down to 0 Critical/High.

---

## Parallelism rules

- UI Phase 6 must not start until Phase 2+3 exit criteria met for inventory path.  
- Historical repair may lag new-path cutover behind feature flag `PURCHASES_GRNI_V2=true`.

---

## Ownership checkpoints

After each phase: update `DEFECT_REGISTER.md`, `IMPLEMENTATION_TASKS.md` checkboxes, and readiness notes.  
Final decision only in `FINAL_READINESS_DECISION.md` when acceptance §66 met.
