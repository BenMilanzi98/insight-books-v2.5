# Receivables Reporting

`generateReceivablesReport` in `subledgerReportsService.js`.

## Design

Operational invoice allocation data determines **aging detail** (expressly
permitted), while the **total reconciles to the Accounts Receivable control
account** in the General Ledger — the control account is the financial truth.

- Control accounts resolve by explicit classification
  (`coaV2SubType`/`controlAccountPurpose`/`systemPurpose` =
  ACCOUNTS_RECEIVABLE) with a name assist for legacy charts.
- Open invoices (business-scoped, not deleted, excluding
  draft/void/cancelled, issued on or before the as-of date, outstanding > 0)
  bucket by days overdue: Current, 1–30, 31–60, 61–90, 91–120, 120+.
- Detail rows: customer, invoice number, due date, outstanding amount, bucket.
- Report lines: six buckets, Customer Subledger Total, Accounts Receivable
  Control (with source accounts, drill-down basis AS_OF), and a VARIANCE line
  showing the exact subledger-minus-control difference.

## Reconciliation (REP-006)

`totals` carries `subledger`, `controlAccount`, `difference`, `reconciles`.
A non-zero difference attaches a REP-006 warning and forces UNVERIFIED — the
report is never labelled verified while the customer subledger and control
account differ materially. Tested: a "ghost" operational invoice with no
journal produces exactly its amount as the disclosed difference.

Related views (customer statements, receivables movement) are drill-down
compositions over the same control accounts and canonical lines.
