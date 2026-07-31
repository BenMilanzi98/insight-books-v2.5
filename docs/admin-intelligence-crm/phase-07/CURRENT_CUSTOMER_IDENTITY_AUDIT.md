# Current Customer Identity Audit

| Finding | Classification |
|---------|----------------|
| `Tenant.id` is stable platform customer key | CORRECT_AND_REUSABLE |
| `Tenant.name` / `subdomain` display identity | CORRECT_AND_REUSABLE |
| No separate Customer table | STANDARDISE — Tenant = Customer |
| `Tenant.ownerUserId` = tenant admin, not CS owner | WRONG_SCOPE for CS — use portfolio ownership |
| No merge / duplicate-review workflow | EXTEND in Wave 1–3 |
| Fuzzy name matching absent (good) | CORRECT_AND_REUSABLE |
