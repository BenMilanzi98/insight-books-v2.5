# Current Demo Credential Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Demo environment credentials store | NOT_FOUND | No Demo credential vault / refs |
| Credential expiry tied to env | NOT_FOUND | — |
| Production credential reuse in Demo | FORBIDDEN / absent | Must block |
| MRA TAC / secret provider refs | WRONG_DOMAIN | MRA EIS secret leases — not Demo env credentials |
| Admin auth / CRM FLS | CORRECT_AND_REUSABLE | `authz.js` `resolveCrmAccess` — Demo APIs must use same FLS pattern |
| Public capture passwords | N/A | Public forms have no Demo env credentials |

**Implication:** Wave 3 protect Demo credentials; never store Production secrets on Demo env records; expire with environment.
