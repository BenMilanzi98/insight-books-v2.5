# Duplicate Posting Risk Register

| ID | Risk | Severity | Evidence | Disposition |
|----|------|----------|----------|-------------|
| P-01 | Booking posts invoice GL immediately | High | `postInvoiceAccounting` in create TX | `INCORRECT_ACCOUNTING` timing |
| P-02 | Retry of POST may create second booking+invoice | High | No booking idempotency key | `DUPLICATE_POSTING_RISK` |
| P-03 | Invoice adapter may be idempotent by invoiceId — booking row is not | Medium | Create path | `EXTEND` |
| P-04 | Complete/cancel may not reverse GL | High | Lifecycle deletes slots only | `INCOMPLETE` |
| P-05 | Inbound hire re-expense on payment | N/A today | Feature missing | Prevent in design |
