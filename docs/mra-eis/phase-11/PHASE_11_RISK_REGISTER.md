# Risk Register

| Risk | Mitigation |
|---|---|
| Post-commit bridge failure | Recovery message + reconcile repair |
| POS duplicate sales without idempotency key | Documented residual gap G11-003 |
| Split/VAT5 unclear contracts | Fail closed |
| Operators claiming MRA accepted | Status messaging forbids it |

---
*Phase 11 implementation. Local sales eligibility + bridge only. No MRA Sale submission, fiscal number, QR, or “MRA validated” receipt. Bridge creates no Journal/Stock Movement. Customer payments are not Sales. Draft/Quote/Proforma excluded.*
