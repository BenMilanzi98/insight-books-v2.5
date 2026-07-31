# Design Stub — Expense Traceability

**Date:** 2026-07-25  
**Tag:** `EXTEND` (partially available via V2 source references today)

## Trace chain

```
Expense.id
  → AcctV2EventRegistry (sourceType=Expense, eventType=EXPENSE_POSTED)
    → Journal / JournalEntryLine
      → Ledger queries / drill-down reports

Payment.id (expense payment)
  → AcctV2EventRegistry (sourceType=ExpensePayment, eventType=EXPENSE_PAYMENT)
    → Journal / JournalEntryLine
```

## Required UI links

| From | To |
|------|----|
| Expense detail | “View journal” using source reference |
| Journal line | Back-link to expense / payment |
| Payment row | Settlement journal |
| P&L drill-down | Expense document |

Reuse V2 report drill-down (`app/api/accounting-v2/reports/drill-down`) where possible — `REUSE`.

## Audit fields to persist / expose

- `sourceModule`: `EXPENSES`  
- `sourceType` / `sourceId` / `sourceNumber` (`originalReference` or expense id)  
- `eventRegistryId` on journal metadata  
- Actor `userId`, timestamps  
- Idempotent replay flag on read APIs

## Forensic checks

1. For each `APPROVED` expense with `expenseAccountId`, exactly one recognition journal (unless reversed).  
2. Sum of expense-account debits from recognition events equals recognized net (not payment events).  
3. Payment journals’ expense-account debits = **0** after GAP-008 fix.

## Multi-tenant

All trace queries filter `tenantId` first; never resolve journal by id alone across tenants.
