# Security Risk Register — Admin Intelligence / CRM

**Audited:** 2026-07-28

| ID | Risk | Severity | Evidence | Mitigations (later phases) |
|----|------|----------|----------|----------------------------|
| SEC-01 | Impersonation / support access misuse | Critical | `PlatformSupportAccess` | Time-bound grants, audit every action, separate from CRM |
| SEC-02 | Admin JWT without fine-grained intel permissions | High | Broad admin roles today | Add `intel.*` / `crm.*` keys before shipping BI |
| SEC-03 | Cross-tenant data in exports | Critical | Future CSV/XLSX | Scope + permission + watermark + audit |
| SEC-04 | PII in leads/CRM (phone, email) | High | Future Lead models | Encryption at rest policy; retention; access logs |
| SEC-05 | Payment callback spoofing | High | PayChangu webhooks | Existing signature verification must remain sole mutation path |
| SEC-06 | Hardcoded secrets in docs/scripts | Medium | `.env` modified in repo status | Never commit secrets; Phase 1 scripts read-only |
| SEC-07 | Admin search exposing tenant secrets | Medium | AdminGlobalSearch | Exclude credentials, API keys, tokens from index |
| SEC-08 | AI prompts including raw tenant journals | High | Future AI layer | Evidence allow-list only; no GL dumps |

## Phase 1 constraint

No new auth paths, no permission widening, no impersonation changes.
