# Demo Security Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Demo FLS keys / APIs | NOT_FOUND | No Demo routes to guard |
| CRM authz pattern | CORRECT_AND_REUSABLE / EXTEND | `resolveCrmAccess` / `resolveCrmScope` in `authz.js` |
| Scope stub `mode: 'all'` | PARTIAL / CARRY | Lists may over-include until hardened |
| SoD automation pattern | CORRECT_AND_REUSABLE pattern | `automation/*` requester ≠ approver — reuse for content/env approvals |
| CoA admin | FORBIDDEN / removed | Must stay removed |
| MRA / payment secrets on Demo | FORBIDDEN | No Production/MRA endpoint connections on Demo env |
| Cross-Tenant Demo access | FORBIDDEN if attempted | Demo is System Admin CRM plane |
| SQL + model guards (EPERM) | CARRY / FOUNDATION | P13 `hasCrm*Model` pattern — apply to Demo models |
| Public capture spam guards | FOUNDATION | Size + honeypot + process-local throttle in capture |

**Implication:** All Demo APIs FLS; SoD on sensitive approvals; never expose Production/MRA secrets; SQL fallbacks if Prisma EPERM.
