# Training Security Matrix

| Control | Required | Current | Class | Wave |
|---------|----------|---------|-------|------|
| `training*` permission set | Yes | Only `customerSuccess.read` on foundations page | NOT_FOUND / EXTEND | 1–4 |
| Portfolio / assignment scope | Yes | CS portfolio exists | EXTEND / CUSTOMER_PORTFOLIO_RISK | 1–4 |
| CRM scope harden | Carry | `resolveCrmScope` mode all | CROSS_TENANT_RISK | Carry |
| Idempotency exact retry | Yes | Handoff emit yes; Request/Program no | EXTEND | 1 |
| SoD author/approver / correct/approve / grade/regrade / issue/revoke | Yes | Absent | NOT_FOUND | 2–4 |
| Materials + env isolation | Yes | Absent | FILE_SECURITY_RISK | 2 |
| No credentials in docs/export/search | Yes | Handoff forbids forge complete; export absent | FORBIDDEN / CORRECT_AND_REUSABLE | 3–4 |
| Assessment answer confidentiality | Yes | Absent | ASSESSMENT_TRUTH_RISK | 3 |
| Accounting / Subscription mutate forbid | Yes | Boundary elsewhere | FORBIDDEN from Training | All |
| Cache key projections | Yes | Absent | CONTACT_PRIVACY_RISK | 4 |
