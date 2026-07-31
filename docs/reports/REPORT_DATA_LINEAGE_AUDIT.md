# Report Data Lineage Audit

**Date:** 2026-07-22

Target lineage (master prompt):

```
Report → Report Line → CoA Account → Journal Entry Lines → Journal
  → Source transaction → Module → Documents → Approval → Audit
```

---

## Per-report lineage (as implemented today)

| Report | Screen path | Financial totals today | CoA codes on lines | JE drill-down | Source txn drill-down | Export same result? |
|---|---|---|---|---|---|---|
| Profit & Loss | `/reports` → profit-loss | GL (TxLine+manual JE) | Partial | Partial (account-trace) | Partial | Unproven parity |
| Profit Analysis | profit-analysis | Analytics / mixed | Weak | Weak | Weak | Unproven |
| Balance Sheet | balance-sheet | GL | Partial + account-trace | Partial | Partial | Unproven |
| Cash Flow | cash-flow | GL **or** ops (multi-tenant) | Weak | Weak | Weak | Unproven |
| Tax Summary | tax-summary | Hybrid ops+GL | Partial | Partial | Invoice/sale refs | Unproven |
| Sales | sales-report | **Ops lead** + GL panel | Weak for ops rows | Weak | Invoice/sale | Unproven |
| Expenses | expense-report | **Ops lead** + GL panel | Weak | Weak | Expense docs | Unproven |
| Stock Movement | stock-movement | **Ops** qty/value | Weak / none | Rare | Movement | Unproven |
| Inventory Loss | inventory-loss-report | **Ops** write-offs | Weak | Rare | Write-off | Unproven |
| Daily POS | pos-daily | **Ops** POS | Weak | Rare | Receipt | Unproven |
| V2 statements | `/reports-v2` | **JE V2 only** | Stronger contracts | Yes (drill-down API) | Via JE source refs | Designed same envelope |

---

## Broken / weak links

1. **Ops → money without JE:** Sales, Expenses, POS, Stock, Loss can display financial amounts not proven equal to JE aggregation.  
2. **Cash Flow dual path:** Multi-tenant switches authority away from GL.  
3. **Dual ledger:** V1 and V2 define “posted journals” differently → lineage forks.  
4. **Summary lines:** “Revenue”, “Total Assets” often lack mandatory “View source accounts” with codes/names.  
5. **Exports:** Separate builders; not guaranteed identical watermark/definition version.  
6. **Unmapped accounts:** Material activity can be omitted without blocker on legacy hub.

---

## Required lineage for reimplementation

Every financial cell must carry:

- `sourceAccounts[]` `{ accountId, accountCode, accountName, debit, credit, net, journalLineCount }`
- `drillDownToken` → accounts → JE lines → sourceReference
- `definitionVersion`, `mappingVersion`, `postingWatermark`

Operational columns (qty, cashier, SKU) remain context-only and must not alter financial totals.
