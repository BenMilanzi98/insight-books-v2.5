# Current Demo Script Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CrmDemoScript / versions | NOT_FOUND | No script models under CRM Demo |
| Restricted vs customer-safe script | NOT_FOUND | Design: restricted Script never on invitations/Customer APIs |
| en/ny script foundations | NOT_FOUND | Locale UI exists elsewhere; no Demo script i18n packs |
| AI-generated scripts | FORBIDDEN | Design out of scope; must not invent |
| Email templates as script | WRONG_DOMAIN | `lib/admin/crm/emails/templates.js` — Email Activity plane |
| Activity templates as script | WRONG_DOMAIN / pattern only | `templates.js` Activity/Task — do not alias as Demo Script |

**Implication:** Wave 2 Script versioning + SoD; restricted projection fail-closed on Customer/invitation surfaces.
