# Support Privacy Audit

| Risk | Required control |
|------|------------------|
| Internal notes to customers | API projection exclude |
| Credentials in ticket body | Reject/redact validators |
| MRA payloads / payment secrets | Never store |
| Public attachment URLs | Forbidden |
| Tenant GL in tickets | Forbidden |
| Restricted security tickets | Confidentiality level + permission |

Reuse Phase 3 masking standards; Phase 4 redact helpers where applicable.
