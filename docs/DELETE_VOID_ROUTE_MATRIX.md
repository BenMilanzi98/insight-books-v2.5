# DELETE / void / reversal route matrix

**Purpose:** Single inventory of `app/api` routes that remove, void, cancel, or reverse data—classified for accounting and audit discussions.  
**Companion docs:** [TRANSACTION_REVERSAL_AUDIT_POLICY.md](./TRANSACTION_REVERSAL_AUDIT_POLICY.md), [TRANSACTION_REVERSAL_AND_AUDIT.md](./TRANSACTION_REVERSAL_AND_AUDIT.md).  
**Last reviewed:** 2026-03-28 (code snapshot: `app/api/**/route.js`).

## How to read classifications

| Classification | Meaning |
|----------------|---------|
| **A — Posted financial** | Touches or corrects GL (`Transaction` / `JournalEntry`), payments, tax, inventory valuation, or supplier/customer balances. Removal must be **reversal, void, or cancel-with-reason**, not silent row loss. |
| **B — Draft / pre-posted** | Unposted or low-risk documents (e.g. drafts, templates). Hard delete may be acceptable if no posted impact. |
| **C — Master / configuration** | Reference data (accounts, tax types, departments). Often hard delete with guards, or soft-delete/deactivate. |
| **D — Operational / HR** | Time, attendance, performance artifacts—typically not GL, but may need audit policy. |
| **E — Dev / test / admin tooling** | Non-production or super-admin endpoints. |
| **F — Attachment / artifact** | File rows or secondary records, not primary financial documents. |

**HTTP column:** `DELETE` = REST DELETE handler; `POST` = correction flow that behaves like void/reverse/refund (included so the matrix stays the single place teams look).

---

## POST — Central reversals and voids (financial)

| Route | Class | Behavior summary |
|-------|-------|------------------|
| `POST /api/transactions/reverse` | A | `createTransactionReversal` and typed reversals via `lib/transactionReversalService.js`. |
| `POST /api/payroll/reverse` | A | Payroll reversal (dedicated flow; see route). |
| `POST /api/invoices/void` | A | Void invoice with reason; blocks when payments exist; journal/tax reversal pattern. |
| `POST /api/invoices/[id]/delete` | A | Same void semantics as `DELETE /api/invoices/[id]` (legacy/alternate path). |
| `POST /api/sales/[id]/void` | A | Void completed sale; inventory restore + status; requires reason. |
| `POST /api/sales/[id]/refund` | A | Refund path (financial impact). |
| `POST /api/invoices/refund` (+ `.../refund/process`) | A | Invoice refund processing. |

---

## DELETE — Financial and inventory-facing

| Route | Class | Behavior summary |
|-------|-------|------------------|
| `DELETE /api/invoices/[id]` | A | Void + reversing journals; invoice row retained; reason required; blocks if payments applied. |
| `DELETE /api/payments/[id]` | A | Full reversal pipeline; `reversalReason` / `reason`; no hard delete of payment facts. |
| `DELETE /api/expenses/[id]` | A / B | Posted: `createExpenseReversal` then soft-delete; unposted: removal with audit. |
| `DELETE /api/purchases/bills/[id]` | A | Cancel with mandatory reason; `createTransactionReversal` when `journalEntryId`; inventory guards for consumed FIFO. |
| `DELETE /api/purchases/orders/[id]` | A | PO **cancellation** with reversals (`createExpenseReversal`, `createTransactionReversal` for bills); blocks if goods received or paid bills. |
| `DELETE /api/sales/[id]` | B | **Draft only** hard delete; posted/completed must use void/refund/reversal. |
| `DELETE /api/sales/clear-history` | A / B | Bulk draft cleanup; **blocked** if posted sale journals or any non-draft sale; requires `reversalReason`. |
| `DELETE /api/journal-entries/[id]` | A / B | **Posted:** blocked (“reverse instead”). **Draft:** hard delete + audit. |
| `DELETE /api/payroll/[id]` | A / B | **Processed** payroll blocked. Non-processed: hard delete + audit. |
| `DELETE /api/recurring-expenses/[id]` | C / B | Template row hard delete + audit (not a posted expense until generated). |
| `DELETE /api/liabilities/[id]` | A | Hard delete liability + cascaded payments (review for policy alignment). |
| `DELETE /api/gratuity/[id]` | A / D | Deletes gratuity account + payments (hard delete). |
| `DELETE /api/salary-advances/[id]` | D / A | Hard delete if no deductions; else blocked (cancel instead). |
| `DELETE /api/capital-account` | A / C | Deletes identified equity “capital” `Account` if no balance and no `JournalEntry` usage; else errors. |
| `DELETE /api/budgets/[id]` | B | Revenue budget delete via service helper (planning, not GL posting). |

---

## DELETE — Master data, configuration, org

| Route | Class | Behavior summary |
|-------|-------|------------------|
| `DELETE /api/clients/[id]` | C | Hard delete if **no invoices**; else error (suggests inactive). |
| `DELETE /api/employees/[id]` | C | **Soft:** deactivate / terminate; preserves payroll history. |
| `DELETE /api/suppliers/[id]` | C | Delegates to `deleteSupplier` (soft semantics in module). |
| `DELETE /api/purchases/suppliers/[id]` | C | `isActive: false` (soft). |
| `DELETE /api/chart-of-accounts/[id]` | C / A | If posted lines exist: **deactivate**. Else delete if no children. |
| `DELETE /api/accounts/[id]` | C | Hard delete blocked if “used in journal entries” (legacy check); else delete. |
| `DELETE /api/payment-accounts/[id]` | C / A | Deactivate if allocations exist; else hard delete + audit. |
| `DELETE /api/tax-types/[id]` | C | **Hard delete** (TODO in code: usage check not enforced). |
| `DELETE /api/departments/[id]` | C | Hard delete if no employees. |
| `DELETE /api/deductions/[id]` | C | Hard delete. |
| `DELETE /api/benefits/[id]` | C | Hard delete (cascade assignments). |
| `DELETE /api/branches/[id]` | C / A | Default: **soft** (`isActive: false`). `?hard=true` only if zero linked sales/invoices/expenses/payments/transactions/journal entries. |
| `DELETE /api/roles/delete` | C | Body `roleId`; blocked if users assigned. |
| `DELETE /api/users/delete` | C | **Soft:** `isActive: false`, `status: deleted` + audit. |
| `DELETE /api/invoice/templates/[id]` | B / C | Hard delete if not default template. |
| `DELETE /api/stock/[id]` | C / A | **Soft:** `isDeleted`, `deletedAt` on `Product` + audit (keeps history). |

---

## DELETE — HR, attendance, performance, leave

| Route | Class | Behavior summary |
|-------|-------|------------------|
| `DELETE /api/attendance/[id]` | D | Hard delete attendance record. |
| `DELETE /api/attendance/bulk-delete` | D | `deleteMany` by date range / quick filters. |
| `DELETE /api/attendance/finalize/list` | D | Clears finalized register logs in window. |
| `DELETE /api/leave/[id]` | D | Sets status **Cancelled** (not physical delete). |
| `DELETE /api/leave-requests/[id]` | D | Pending-only cancellation semantics. |
| `DELETE /api/leave-policies/[id]` | C / D | Hard delete if no leave requests; else error. |
| `DELETE /api/performance-reviews/[id]` | D | Hard delete (+ cascade criteria). |
| `DELETE /api/performance-goals/[id]` | D | Hard delete. |
| `DELETE /api/performance-feedback/[id]` | D | Hard delete. |
| `DELETE /api/assets/[id]` | A / D | Fixed asset register hard delete (depreciation cascades). |

---

## DELETE — Pre-sales and misc

| Route | Class | Behavior summary |
|-------|-------|------------------|
| `DELETE /api/quotations/[id]` | B | **Hard delete** quotation + items; blocks if status `Converted`. |

---

## DELETE — Attachments and secondary rows

| Route | Class | Behavior summary |
|-------|-------|------------------|
| `DELETE /api/invoices/[id]/attachments/[attachmentId]` | F | Removes attachment record/file. |
| `DELETE /api/expenses/[id]/attachments/[attachmentId]` | F | Removes attachment record/file. |

---

## DELETE — Dev, test, admin

| Route | Class | Behavior summary |
|-------|-------|------------------|
| `DELETE /api/test-delete` | E | Test harness. |
| `DELETE /api/test-simple` | E | Test harness. |
| `DELETE /api/admin/test-delete` | E | Admin test. |
| `DELETE /api/admin/security/sessions/[id]` | E | Admin session terminate + audit log. |

---

## Not covered here

- **Debit notes / credit notes** — current `app/api/debit-notes` and `credit-notes` routes expose **no** `DELETE` handlers in this snapshot (corrections may be via other APIs or UI flows).
- **POST batch helpers** — e.g. `POST /api/expenses/batch-delete`, `POST /api/stock/batch-delete`: follow the same policy as single-entity deletes (see `TRANSACTION_REVERSAL_AUDIT_POLICY.md`).
- **Non-`route.js` handlers** — only `app/api/**/route.js` was inventoried.

---

## Maintenance

When adding or changing a DELETE/void/reversal endpoint:

1. Update this matrix in the same PR.
2. Extend [TRANSACTION_REVERSAL_AUDIT_POLICY.md](./TRANSACTION_REVERSAL_AUDIT_POLICY.md) if behavior rules change—not only route paths.
