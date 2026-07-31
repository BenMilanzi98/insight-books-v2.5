# Tax Reporting

`generateModuleReport(db, ctx, request, 'TAXES')` — credit-normal
presentation.

Covers tax liabilities (TAX_LIABILITY, VAT, PAYE, WITHHOLDING_TAX sub-types;
VAT_PAYABLE / PAYE_PAYABLE / TAX purposes; name assists for "VAT", "PAYE",
"withholding", "tax payable") and tax expense (TAX / INCOME_TAX sub-types).

Fixture assertion: VAT Payable 2100 and Tax Expense 5600 both appear as
account lines with canonical balances.

Rules honoured:

- Tax reports reconcile to configured tax accounts — the totals **are** those
  accounts' canonical balances; REP-012 findings disclose any difference from
  operational tax registers.
- No tax treatment is invented: the engine reports posted amounts only. VAT
  input/output detail, MRA/EIS integration summaries and filing views remain
  the tax module's screens over the same accounts.
- Where classification is uncertain (account mapped only by name assist), the
  envelope carries a `MAPPING_ASSISTED` review warning rather than a silent
  assumption.
