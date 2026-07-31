# Duplicate Posting Risk Register

| ID | Risk | Severity | Evidence | Mitigation target |
|----|------|----------|----------|-------------------|
| DPR-01 | GR credits AP; bill also credits AP | **Critical** | Templates + auto-bill journal reuse incomplete for manual bills | True GRNI; bill clears GRNI only |
| DPR-02 | Bill debits Inventory after GR already did | **Critical** | `SUPPLIER_BILL` inventory debit | Matched inventory bill: no Inv debit (except PPV/landed) |
| DPR-03 | Concurrent GR apply races | **High** | `inventoryAppliedAt` check without strong lock/unique | Unique movement + SELECT FOR UPDATE |
| DPR-04 | FIFO sourceId shared across lines | **High** | `sourceId: goodsReceipt.id` | Per-line / per-alloc sourceId + unique |
| DPR-05 | Payment double-post on retry | **High** | Weak payment idempotency | Idempotency key + unique journal source |
| DPR-06 | Page refresh re-POSTs create | **High** | Client forms without Idempotency-Key | Required header + server store |
| DPR-07 | Auto-bill number find-loop | **Medium** | `allocateGoodsReceiptBillNumber` | Sequence service |
| DPR-08 | Supplier balance increment ≠ journals | **High** | `currentBalance.increment` on auto-bill | Derive from AP subledger / journals |
| DPR-09 | Shared journalEntryId GR+Bill | **Medium** | Follow-on sets bill.journalEntryId = GR JE | Separate docs; link via match, not shared JE |
| DPR-10 | Approval replay / status toggle | **Medium** | Ad hoc status updates | Command + version optimistic lock |

Initial Critical count (posting): **2** (DPR-01, DPR-02)  
Initial High count (posting-related): **4+** (DPR-03…06, DPR-08)
