# Current Attachment Audit

| Item | Class | Evidence |
|------|-------|----------|
| Support ticket attachments | NOT_FOUND | — |
| Admin email upload | PRIVACY_RISK / WRONG_SCOPE | `app/api/admin/upload-attachment` → `public/uploads/email-attachments` |
| Malware scan state machine | NOT_FOUND | — |
| Private object storage for tickets | NOT_FOUND | — |

**Disposition:** Wave 2 SupportAttachment with PENDING_SCAN→CLEAN|QUARANTINED; never public web dir; download reauth.
