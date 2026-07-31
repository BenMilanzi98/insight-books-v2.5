# First-Value Matrix

| Feature | Start population | First-value end event | Uniqueness scope | Live today |
|---------|------------------|-----------------------|------------------|------------|
| `invoices.post` | Entitled invoice customers | First `SALES_INVOICE_POSTED` | tenant + feature + ruleVersion | NOT_INSTRUMENTED |
| `sales.pos.complete` | Entitled POS customers | First `POS_TRANSACTION_COMPLETED` | tenant + feature + ruleVersion | NOT_INSTRUMENTED |
| `eis.fiscal.accept` | EIS-entitled tenants | First `MRA_EIS_TRANSACTION_ACCEPTED` | tenant + feature + ruleVersion | NOT_INSTRUMENTED |
| Other repo modules | — | Feature-specific TBD when producers added | — | NOT_INSTRUMENTED |

**Forbidden endpoints:** page-view timestamp, login timestamp, entitlement createdAt alone.
