# Current Contact Consent Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Consent records on Contact / Lead | NOT_FOUND | — |
| Consent source traceability | NOT_FOUND | — |
| Explicit opt-in capture on forms | NOT_FOUND | Contact form collects PII without CRM consent object |
| Inferred consent from form submit | FORBIDDEN if implemented | Must never infer; today nothing persists |
| DNC list / flag | NOT_FOUND | — |
| Marketing email preference store | NOT_FOUND | Platform email templates ≠ CRM consent |
| Tenant client marketing flags | WRONG_DOMAIN | Tenant CRM-ish fields if any ≠ platform CRM |

**Implication:** Wave 3 consent objects with source evidence; DNC eligibility service. Forms must capture explicit consent before marketing channels.
