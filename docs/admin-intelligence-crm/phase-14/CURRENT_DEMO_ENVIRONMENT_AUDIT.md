# Current Demo Environment Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CrmDemoEnvironment / DENV numbering | NOT_FOUND | No Demo env models; no `lib/admin/crm/demos/environments*` |
| Logical provisioner | NOT_FOUND | Design: governance + local/logical READY; no cloud fabricate |
| Production Tenant clone | FORBIDDEN / absent | Must never implement as Demo Environment |
| MRA EIS sandbox entitlement | WRONG_DOMAIN / FORBIDDEN | `entitlementService.js` sandboxAllowed; `lib/admin/customers/mraEis.js`; Tenant MRA settings UI — fiscal sandbox ≠ Sales Demo env |
| EIS_ENVIRONMENT sandbox | WRONG_DOMAIN | `lib/eisService.js` `process.env.EIS_ENVIRONMENT \|\| 'sandbox'` — MRA connector |
| DEMO banner / isolation flags | NOT_FOUND | No Demo env UI banner |
| Expiry / reset / deprovision | NOT_FOUND | — |
| Provision idempotency | NOT_FOUND | — |
| Production connection guards | NOT_FOUND | Design: no Production DB/payment/MRA EIS endpoint/email sender on Demo env |

**Implication:** Wave 3 logical provisioner only. Explicitly reject aliasing MRA EIS sandbox or Production Tenant as Demo Environment.
