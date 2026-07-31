# Loan Reconciliation

Comparison set: loan contracts, proceeds, principal schedules, interest
schedules, repayments, loan liability account, interest expense, interest
payable, bank transactions.

| Pattern | Repair |
|---|---|
| Loan proceeds posted as revenue | `RECLASSIFICATION_REPAIR` (Dr Revenue / Cr Loan liability) — test-covered in the wrong-account group |
| Contract exists, liability journal missing | `MISSING_JOURNAL_REPAIR` from the signed contract + bank receipt |
| Principal repayment posted as expense | `RECLASSIFICATION_REPAIR` (Dr Loan liability / Cr Expense) |
| Interest not separated from principal | `RECLASSIFICATION_REPAIR` splitting per the schedule |
| Duplicate repayment journal | `DUPLICATE_EFFECT_REPAIR` |
| Schedule differs from ledger | Investigation → attribute to specific missing/duplicate/misclassified postings; residual is an exception |
| Loan journal without loan dimension | Dimension repair |
| Currency difference | `AMOUNT_ADJUSTMENT_REPAIR` under FX policy, or exception |
| Opening loan without journal | Opening repair (evidence → journal; else exception) |
| `LOAN_CONTROL_DIFFERENCE` residual | Exception |

Acceptance: loan principal ledger reconciles to the schedule; interest expense
stays separate from principal; proceeds never appear as revenue.
