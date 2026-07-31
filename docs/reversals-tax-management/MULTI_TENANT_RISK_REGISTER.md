# Multi-Tenant Risk Register

| ID | Risk | Mitigation |
|----|------|------------|
| R-MT01 | Reverse APIs must scope by session tenantId | Mitigated: live IDOR suite + `tenantId` on approve/reject/pending |
| R-MT02 | List API loads broad sets | Mitigated: tenant-scoped queries + live list isolation tests |
| R-MT03 | Tax balances IDOR on account id | Mitigated: tenantId on tax-management routes + live dual-tenant suite |
