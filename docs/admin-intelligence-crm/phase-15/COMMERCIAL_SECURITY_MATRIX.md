# Commercial Security Matrix

| Control | Exists? | Path | Class |
|---------|---------|------|-------|
| resolveCrmAccess on Opp/Demo | Yes | authz.js | CORRECT_AND_REUSABLE |
| Commercial-specific permissions | No | — | NOT_FOUND → Wave 1–4 |
| resolveCrmScope owner/team/territory | Stub all | authz.js | FOUNDATION / CROSS_TENANT_RISK |
| Secure review token | No | — | NOT_FOUND / PUBLIC_LINK_RISK |
| Rate limit review | No | — | NOT_FOUND |
| Private artifact ACL | No | — | NOT_FOUND |
| Tenant Quotation ID confusion | Risk | — | WRONG_DOMAIN guard needed |
| Customer-safe projection | No | — | CONTACT_PRIVACY_RISK |
| SoD on protected approvals | No (commercial) | — | APPROVAL_BYPASS_RISK |
