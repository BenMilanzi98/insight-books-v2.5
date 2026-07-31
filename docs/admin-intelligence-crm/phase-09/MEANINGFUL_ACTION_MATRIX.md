# Meaningful Action Matrix

| Feature code | Meaningful action | Server source (candidate) | Event code (planned) | Exclusions |
|--------------|-------------------|---------------------------|----------------------|------------|
| `invoices.post` | Posted sales invoice | Invoice/Sale post path | `SALES_INVOICE_POSTED` | drafts, voids without post, reprints |
| `sales.pos.complete` | Completed POS sale | POS complete path | `POS_TRANSACTION_COMPLETED` | abandoned carts, reprints |
| `eis.fiscal.accept` | Accepted fiscal transmission | Accepted receipt/transmission | `MRA_EIS_TRANSACTION_ACCEPTED` | retries, rejects, reprints |
| *all others* | — | Domain candidates only | — | NOT_INSTRUMENTED |

**Must not qualify:** page open, menu click, search, failed post, background job, monitoring, browser refresh.
