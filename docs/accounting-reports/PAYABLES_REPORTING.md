# Payables Reporting

`generatePayablesReport` in `subledgerReportsService.js`. Mirrors the
receivables design with the Accounts Payable control account (credit-normal:
the control total is the negated signed GL balance).

- Supplier bills (business-scoped, excluding draft/cancelled/void, dated on or
  before the as-of date, outstanding = total − paid > 0) bucket by days
  overdue: Current, 1–30, 31–60, 61–90, 91–120, 120+.
- Detail rows: supplier, bill number, due date, outstanding, bucket.
- Lines: buckets, Supplier Subledger Total, Accounts Payable Control (source
  accounts, `displaySign: -1`, drill-down basis AS_OF), VARIANCE difference
  line.
- REP-007: any subledger-versus-control difference is disclosed exactly and
  forces UNVERIFIED; supplier statements/outstanding-bill views compose from
  the same data.

Fixture assertion: bill 90,000 with 30,000 paid → subledger 60,000 = AP
control 60,000, reconciles, draft bill excluded.
