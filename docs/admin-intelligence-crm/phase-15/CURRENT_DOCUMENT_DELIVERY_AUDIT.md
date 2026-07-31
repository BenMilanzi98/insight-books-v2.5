# Current Document Delivery Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CRM commercial delivery service | NOT_FOUND | — |
| Delivery methods EMAIL_ATTACHMENT / SECURE_LINK / PORTAL | NOT_FOUND | Design |
| Phase 13 CRM email send | EXTEND | `lib/admin/crm/emails/*` — reuse for delivery where eligible |
| Consent / eligibility / do-not-email | CORRECT_AND_REUSABLE | Phase 11–13 consent + eligibility |
| Tenant send quotation email | WRONG_DOMAIN / CONTACT_PRIVACY_RISK | `app/api/quotations/[id]/send` — session tenant; not CRM consent plane |
| Idempotent issue + delivery | NOT_FOUND | — |
| Provider callback dedupe | NOT_FOUND | — |

**Implication:** Wave 3 delivery via CRM eligibility + Phase 13 email. Never confuse tenant send with CRM commercial delivery.
