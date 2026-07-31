# Equity Reconciliation

Comparison set: owner capital, capital contributions, share capital, share
premium, retained earnings, current-year earnings, drawings, dividend
declarations/payable/payments, owner and shareholder records, equity GL
accounts.

| Pattern | Repair |
|---|---|
| Capital duplication (all mechanisms) | `OWNER_CAPITAL_DISCREPANCY_REPAIR.md` |
| Drawings posted as expenses | `RECLASSIFICATION_REPAIR` (Dr Drawings / Cr Expense) — test-covered |
| Contributions posted as revenue | `RECLASSIFICATION_REPAIR` (Dr Revenue / Cr Capital) — test-covered |
| Dividends posted directly as expenses | `RECLASSIFICATION_REPAIR` to the dividend equity/payable flow |
| Retained earnings manually duplicated | Stored-balance treatment + duplicate-effect reversal per mechanism |
| Current-year profit stored AND calculated | `REPORT_ONLY_REPAIR` — computed figure is authoritative; stored copy excluded |
| Opening capital duplication | `OPENING_BALANCE_REPAIR.md` |
| Owner dimension missing | Dimension repair |
| Ownership percentages altered by contributions | Operational/equity-module correction (Phase >6 workflow), disclosed |
| `EQUITY_CONTROL_DIFFERENCE` residual | Exception |

Approval: equity corrections are HIGH risk (Finance Manager + owner/authorized
approver where contributions are affected), separation of duties enforced.

Acceptance: the Equity Statement reconciles, the Statement of Changes in Equity
is supportable line-by-line from journals, and Balance Sheet equity agrees with
the ledger. Dev dataset: the only equity findings are the capital/stored-balance
anomalies documented in the capital repair doc.
