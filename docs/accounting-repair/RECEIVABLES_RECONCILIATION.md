# Receivables Reconciliation

Identity: invoices − credit notes − customer payments − refunds/write-offs =
customer subledger balance = AR control-account balance (per business, customer,
currency, period).

## Mechanism

Phase 5 `runLedgerReconciliation` includes the AR control comparison
(subledger-derived total vs canonical AR control balance); differences become
`SUBLEDGER_CONTROL_DIFFERENCE` anomalies with the measured delta. Drill-down
investigation then attributes the difference to specific documents.

Defect patterns and repairs:

| Pattern | Repair |
|---|---|
| Invoice (financial, uncancelled) without journal | `MISSING_JOURNAL_REPAIR` |
| Journal without invoice | Orphan procedure (`ORPHAN_JOURNAL_REPAIR.md`) |
| Payment without journal / duplicate payment journal | Missing-journal / `DUPLICATE_EFFECT_REPAIR` |
| Missing credit note effect | `MISSING_JOURNAL_REPAIR` from the credit note |
| Cancelled or draft invoice included in AR | `REPORT_ONLY_REPAIR` (status filter) |
| Payment allocation error | Subledger allocation correction (no GL journal if control total is right) |
| Customer dimension missing on AR line | Dimension repair (metadata where control unaffected) |
| Cross-customer / cross-business posting | Reclassification / `CROSS_BUSINESS_REPAIR` |
| FX / rounding residue | `AMOUNT_ADJUSTMENT_REPAIR` under policy, or exception |
| Opening AR without customer detail | Opening repair + exception if detail unobtainable |

## Acceptance

After repair the customer subledger reconciles to the AR control account or the
residual is a documented exception; AR journal lines carry customer dimensions
where required; every balance drills down to invoices, credits and payments.
Dev dataset: AR control reconciles (no anomaly raised).
