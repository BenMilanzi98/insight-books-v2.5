# Current Platform Invoice Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| PlatformInvoice model | CORRECT_AND_REUSABLE foundation | Unique `idempotencyKey`; period uniqueness |
| Create API idempotent | FOUNDATION / EXTEND | `platform-billing/invoices/route.js` replay on key/P2002 |
| Renewals invoice create | FOUNDATION | Same idempotency pattern |
| Invoice from accepted snapshot | NOT_FOUND | Body-driven amounts today |
| CREATE_PLATFORM_INVOICE_IF_REQUIRED | NOT_FOUND | — |
| Fabricated PAID on create | CORRECT_AND_REUSABLE boundary today | `amountPaid: 0` on create |
| Duplicate risk | BILLING_DUPLICATION_RISK | Mis-keyed idempotency / period collision |

**Implication:** Wave 3 bind lines to accepted snapshot + conversion idempotency key.
