# Tax Accounting Posting Matrix

All tax GL posts through Accounting V2 templates / adapters. No direct Account.balance edits.

| Event | Debit | Credit | Template / path |
|-------|-------|--------|-----------------|
| Sale / invoice with output VAT | AR / Cash | Revenue + VAT_OUTPUT | Sale / Invoice templates |
| Purchase / expense with input VAT | Expense + VAT_INPUT | AP / Cash | Purchase / Expense templates |
| Tax settlement payment | VAT_OUTPUT / Tax Payable | PRIMARY_BANK | `TAX_SETTLEMENT` via `postTaxSettlementAccounting` |
| Document reversal | Opposite of original lines | Opposite | `reverseJournal` / `reverseSourceJournals` |
| TaxTransaction subledger | N/A (projection) | N/A | Derived from posted journal lines |

## Dual-run COA
Operational fixed accounts 2041 (inflow) / 2045 (outflow) remain until purpose maps fully resolve. Mapping service prefers `TaxAccountMapping`, falls back to TaxType.accountId / fixed init.
