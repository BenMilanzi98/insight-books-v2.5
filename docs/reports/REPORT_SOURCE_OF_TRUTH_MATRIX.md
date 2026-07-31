# Report Source of Truth Matrix

**Date:** 2026-07-22  
**Policy:** Financial totals = posted ACCOUNTING_V2 Journal Entry Lines only. Operational tables = context.  
**Hub:** `/reports-v2` (**CLOSED** cutover). Legacy `/reports` redirects.

| Report figure | Canonical source | Product path (`/reports-v2`) | Must reconcile to |
|---|---|---|---|
| P&L Revenue | Revenue JE lines | `INCOME_STATEMENT` | `SALES` revenue |
| P&L COGS | COGS JE lines | `INCOME_STATEMENT` | `SALES` COGS |
| P&L OpEx | Expense JE lines | `INCOME_STATEMENT` | `EXPENSES` |
| P&L Net Profit | Net of P&L lines | `INCOME_STATEMENT` / `PROFIT_ANALYSIS` | BS Current Year Earnings |
| BS Assets/Liab/Equity | BS account JE balances | `BALANCE_SHEET` | Subledgers (AR/AP/Inv/Loans/Equity) |
| BS Cash | Cash/Bank JE | `BALANCE_SHEET` | Cash Flow closing cash |
| Cash Flow | Cash JE + classifications | `CASH_FLOW` (indirect) | BS Cash |
| Tax | Tax control JE | `TAXES` | Tax control accounts |
| Sales Net/Tax/COGS | Revenue/Tax/COGS JE | `SALES` (+ invoice context) | P&L |
| Expenses total | Expense JE | `EXPENSES` (+ doc context) | P&L |
| Stock qty | Stock Movements | Context only | Stock domain |
| Stock value | Inventory Asset JE | `STOCK_MOVEMENTS` / `INVENTORY` | Inventory GL |
| Inventory Loss | Loss/Write-off Expense JE | `INVENTORY_LOSS` | P&L loss expense |
| Daily POS sales/tax/COGS | POS-related JE | `DAILY_POS` (JE = SALES basis) | Sales + P&L |
| Trial Balance | All posted JE lines | `TRIAL_BALANCE` | Debits = Credits |

## Forbidden as financial authority

- Draft/cancelled invoices or sales  
- Expense payment of opening payables as new expense  
- Loan principal as expense / loan proceeds as revenue  
- Capital / drawings as P&L  
- Summing parent + child balances  
- Stored `Account.balance` as sole truth  
- Report-only balancing plugs  

## Dual-stack decision (pending design approval)

Until one authority is chosen for the `/reports` selector, the matrix above shows **two current truths**. Reimplementation must collapse the selector onto a single posted-journal authority (recommended: Accounting V2 JE) while keeping operational detail as drill-down context.
