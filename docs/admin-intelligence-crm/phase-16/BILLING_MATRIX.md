# Billing Matrix

| Object | Plane | Create path today | Conversion use | Class |
|--------|-------|-------------------|----------------|-------|
| PlatformInvoice | Platform SaaS | Idempotent admin API | CREATE_IF_REQUIRED from snapshot | FOUNDATION / EXTEND |
| PlatformPayment | Platform SaaS | Admin payments API | Initiate ≠ PAID | FOUNDATION / PAYMENT_TRUTH_RISK |
| PlatformCredit / Refund | Platform | APIs exist | Compensation eligible cases | FOUNDATION |
| Tenant Invoice/Payment | Tenant AR | Tenant apps | Never | WRONG_DOMAIN |
| Billing Account / Schedule | Design | NOT_FOUND | Wave 3 | NOT_FOUND |
| Idempotency helpers | Shared | `platformBilling.js` | Reuse | CORRECT_AND_REUSABLE |
