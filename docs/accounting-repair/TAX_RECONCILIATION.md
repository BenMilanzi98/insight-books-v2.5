# Tax Reconciliation

Comparison set: VAT output, VAT input, VAT payable/receivable, PAYE, pension,
withholding tax, corporate tax, tax returns where available, source invoices
and expenses, tax GL accounts.

| Pattern | Repair |
|---|---|
| VAT duplicated on one document | `DUPLICATE_EFFECT_REPAIR` |
| VAT omitted from a taxable document | `MISSING_JOURNAL_REPAIR` / `AMOUNT_ADJUSTMENT_REPAIR` for the tax portion |
| VAT posted directly as revenue/expense | `RECLASSIFICATION_REPAIR` to the correct tax account |
| Tax liability shown without journal | `UNSUPPORTED_LIABILITY_REPAIR.md` decision table |
| Tax journal without source | Orphan procedure |
| Tax code mismatch | `MISSING_TAX_CODE` → dimension repair where reporting-only; reclassification where the tax account is wrong |
| Wrong tax period | `PERIOD_ADJUSTMENT_REPAIR` with tax-reporting impact recorded |
| Cancelled document included | `REPORT_ONLY_REPAIR` |
| Cross-business tax records | `CROSS_BUSINESS_REPAIR` |
| Unsupported tax balance | Evidence or exception — never invented |
| `TAX_CONTROL_DIFFERENCE` residual | Exception |

Regulatory treatments are never invented: where tax policy is uncertain the
anomaly requires finance/tax specialist review (tax-impacting corrections are
HIGH in the approval matrix and the tax impact is recorded on the batch for
disclosure).
