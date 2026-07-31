# Design Stub — Expense Data Model

**Date:** 2026-07-25  
**Current:** `prisma/schema.prisma` → `model Expense` (single-line)  
**Strategy:** `EXTEND` — keep header; add lines later (Phase 6)

## Header (keep / tighten)

| Field | Target |
|-------|--------|
| `id`, `tenantId`, `branchId` | Required isolation |
| `description`, `date`, `historicalDate` | Unchanged |
| `amount`, `taxAmount`, `taxRate`, `taxTypeId` | Header totals (= sum of lines when multi-line) |
| `expenseAccountId` | **Deprecated for multi-line** when lines exist; retain for single-line compat |
| `category` / `categoryId` | Prefer account-first; category optional label |
| `status` | Enum — see state machine |
| `paymentStatus`, `paidAmount`, `paymentMethod`, `paymentReference` | Enum + decimals |
| `supplierId` | Drives AP recognition credit |
| `submittedById`, audit/reversal fields | Keep |
| `payments` | `Payment[]` settlement records |

## Proposed `ExpenseLine` (Phase 6)

```
ExpenseLine {
  id
  tenantId
  expenseId
  lineNumber
  expenseAccountId   // postable leaf
  description
  amount             // line net or gross — pick one policy and document
  taxAmount
  dimensions JSON?   // project, employee, etc.
}
```

**Posting:** one debit per line (+ tax lines as today).  
**Constraint:** `sum(lines) == header` within rounding tolerance.

## No model today

- `ExpenseLine` — confirmed absent in schema audit.  
- Posting preview persistence — optional `ExpensePostingPreview` not required if preview is ephemeral API.

## Compatibility

Phase 5–6 migration: if no lines, synthesize one virtual line from header `expenseAccountId` + `amount`/`taxAmount` inside adapter so old rows keep posting.
