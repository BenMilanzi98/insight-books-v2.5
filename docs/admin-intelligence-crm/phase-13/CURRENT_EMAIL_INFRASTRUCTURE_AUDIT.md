# Current Email Infrastructure Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| SMTP transporter | FOUNDATION / EXTEND | `lib/email.js` — nodemailer; Hostinger SMTP via EMAIL_HOST/USER/PASSWORD; Ethereal fallback in dev |
| emailService templates | FOUNDATION / EXTEND (adapter only) | `lib/emailService.js` — welcome/affiliate/etc. HTML templates; not CRM Sales templates |
| sendMail evidence | PARTIAL | Functions return nodemailer `info`; no CRM delivery-event persistence |
| Provider accept ≠ delivered | CORRECT_AND_REUSABLE (policy) | Nodemailer accept ≠ mailbox delivered — Wave 2 must map ACCEPTED_BY_PROVIDER/SENT/FAILED; DELIVERED only with evidence |
| CRM email template governance | NOT_FOUND | No versioned Sales email templates under `lib/admin/crm` |
| Tracking pixels | NOT_FOUND / FORBIDDEN invent | Must not add undisclosed pixels in Phase 13 |
| Google / Outlook mail sync | NOT_CONNECTED / NOT_FOUND | No CRM mailbox sync |

**Implication:** Reuse SMTP libs as send adapter only. Persist CrmEmailActivity + send requests; do not treat transactional emails as Sales Activity.

