# Delivery Matrix

| Method / state | Exists? | Path | Class |
|----------------|---------|------|-------|
| EMAIL_ATTACHMENT (CRM commercial) | No | — | NOT_FOUND → Wave 3 |
| EMAIL_SECURE_LINK | No | — | NOT_FOUND → Wave 3 |
| CUSTOMER_REVIEW_PORTAL | No | — | NOT_FOUND → Wave 3 |
| MANUAL_DELIVERY_WITH_EVIDENCE | No | — | NOT_FOUND → Wave 3 |
| E_SIGNATURE_PROVIDER | No | — | NOT_CONFIGURED |
| Phase 13 CRM email send | Yes | emails/* | EXTEND |
| Eligibility / consent gate | Yes | eligibility/consent | CORRECT_AND_REUSABLE |
| Tenant quotation send | Yes | api/quotations/send | WRONG_DOMAIN |
| DELIVERED ≠ VIEWED ≠ ACCEPTED | Design | — | CORRECT_AND_REUSABLE |
