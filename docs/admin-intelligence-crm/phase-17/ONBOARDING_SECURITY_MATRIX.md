# Onboarding Security Matrix

| Control | Required | Current | Class | Wave |
|---------|----------|---------|-------|------|
| `onboarding*` permission set | Yes | Only `customerSuccess.read` on foundations page | NOT_FOUND / EXTEND | 1–4 |
| Portfolio / assignment scope | Yes | CS portfolio exists | EXTEND / CUSTOMER_PORTFOLIO_RISK | 1–4 |
| CRM scope harden | Carry | `resolveCrmScope` mode all | CROSS_TENANT_RISK | Carry |
| Idempotency exact retry | Yes | Handoff emit yes; Request/Project no | EXTEND | 1 |
| SoD template/evidence/go-live/completion | Yes | Absent | NOT_FOUND | 2–3 |
| Hash-only invites | Yes | Conversion invitations | CORRECT_AND_REUSABLE | 3 |
| No temp passwords | Yes | Admin create risk path | PRIVILEGED_USER_RISK | — |
| Document classification + private files | Yes | Absent | FILE_SECURITY_RISK | 3 |
| No credentials in docs/export/search | Yes | Handoff forbids store | FORBIDDEN / CORRECT_AND_REUSABLE | 3–4 |
| Accounting post forbid | Yes | Conversion assert pattern | REUSE_WITH_RECONCILIATION | 3 |
| Cache key projections | Yes | Absent | CONTACT_PRIVACY_RISK | 4 |
