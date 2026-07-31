# Current Document Expiry Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CRM commercial expiry job | NOT_FOUND | — |
| Withdrawal / supersession | NOT_FOUND | — |
| Tenant Quotation.validUntil | WRONG_DOMAIN / EXTEND (pattern) | Validity date exists on tenant quotes |
| Rentals expiresAt + expire action | WRONG_DOMAIN | — |
| Block accept of expired/superseded | NOT_FOUND | Design default |

**Implication:** Wave 3 expiry/withdraw/supersede services; idempotent expiry job.
