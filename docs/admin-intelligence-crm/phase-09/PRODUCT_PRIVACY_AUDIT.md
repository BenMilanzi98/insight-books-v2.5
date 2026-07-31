# Product Privacy Audit

| Risk | Current | Required |
|------|---------|----------|
| Tenant GL / invoice line text in events | Must never | IDs + classifications only |
| MRA credentials / fiscal payloads | Domain tables exist | Never in AnalyticsEvent payload |
| User-level product detail | Not built | Separate permission |
| Android device fingerprint | Absent | Keep absent |
| Session replay | Absent | Keep absent |
| Aggregate leakage of user identity | — | Executives get aggregates only |

**Disposition:** Event context whitelist in Wave 1 emit helpers; redact.js reuse from Phase 4.
