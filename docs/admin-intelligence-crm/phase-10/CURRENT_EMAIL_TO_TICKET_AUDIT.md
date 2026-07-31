# Current Email-to-Ticket Audit

| Capability | Class | Evidence |
|------------|-------|----------|
| Outbound SMTP | CORRECT_AND_REUSABLE | `lib/emailService.js` |
| Admin email templates/suppression | EXTEND later | email-management |
| Inbound ingest / IMAP / webhook | NOT_FOUND | — |
| Message-ID dedupe for tickets | NOT_FOUND | — |
| Mail-loop prevention | NOT_FOUND | — |

**Disposition:** Document integration contract; mark channel NOT_AVAILABLE until ingest exists. Do not fabricate tickets from outbound history.
