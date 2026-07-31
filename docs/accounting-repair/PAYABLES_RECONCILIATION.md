# Payables Reconciliation

Identity: supplier bills − supplier credits − supplier payments = supplier
subledger balance = AP control-account balance (per business, supplier,
currency, period).

Mechanism mirrors receivables: the Phase 5 reconciliation's AP control
comparison raises `SUBLEDGER_CONTROL_DIFFERENCE` anomalies with measured
deltas; investigation attributes them to documents.

| Pattern | Repair |
|---|---|
| Approved bill without journal | `MISSING_JOURNAL_REPAIR` (integration scenario 2 test-covered end-to-end: AP control updated, supplier dimension preserved, source marked posted, `SupplierBill.journalEntryId` linked) |
| Journal without bill | Orphan procedure |
| Payment without journal / duplicate payment | Missing-journal / `DUPLICATE_EFFECT_REPAIR` |
| Missing supplier credit effect | `MISSING_JOURNAL_REPAIR` |
| Cancelled/draft bill included | `REPORT_ONLY_REPAIR` |
| Supplier dimension missing | Dimension repair |
| Cross-supplier / cross-business | Reclassification / `CROSS_BUSINESS_REPAIR` |
| Stored supplier balance without journals / unsupported liability | `UNSUPPORTED_LIABILITY_REPAIR.md` decision table — evidence or exception, never invention |
| Opening AP without supplier detail | Opening repair + exception |
| Currency/rounding residue | `AMOUNT_ADJUSTMENT_REPAIR` under policy, or exception |

Acceptance: supplier subledger reconciles to AP control or residuals are
documented exceptions; AP lines carry supplier dimensions where required. Dev
dataset: AP control reconciles (no anomaly raised).
