# Duplicate Billing Risk Register

| ID | Risk | Severity | Evidence | Disposition |
|----|------|----------|----------|-------------|
| L-01 | Full invoice at every booking — re-book same period = second invoice | High | POST always creates invoice | `DUPLICATE_BILLING_RISK` |
| L-02 | No billing-period uniqueness key | High | N/A table | `REIMPLEMENT` |
| L-03 | No usage/charge identity | High | Features absent | `REIMPLEMENT` |
| L-04 | Recurring job absent — risk when added without idempotency | High | N/A | Block until engine |
