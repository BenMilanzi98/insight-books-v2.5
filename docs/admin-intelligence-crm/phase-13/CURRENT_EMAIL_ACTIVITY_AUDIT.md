# Current Email Activity Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CrmEmailActivity model | NOT_FOUND | Absent from Prisma |
| Email draft / send-request / delivery events | NOT_FOUND | No `lib/admin/crm/emails/*` |
| Email → Lead ingest | NOT_AVAILABLE | `foundations.js` EMAIL_INGEST status NOT_AVAILABLE |
| Outbound Sales email from CRM | NOT_FOUND | No CRM compose/send path |
| Eligibility for EMAIL | CORRECT_AND_REUSABLE | Purpose/channel gate + DO_NOT_EMAIL |
| Fabricated opens/replies | FORBIDDEN (absent = good) | No tracking pixel / reply sync in CRM |
| Platform transactional email | WRONG_DOMAIN for Activity truth | OTP, welcome, affiliate, subscription reminders via `lib/email*.js` — not CrmEmailActivity |
| UI/API | NOT_FOUND | No `/emails` CRM hubs |

**Implication:** Wave 2 introduces Email Activity with eligibility → SMTP send-request → idempotent callbacks; never invent inbound Lead volume or opens.

