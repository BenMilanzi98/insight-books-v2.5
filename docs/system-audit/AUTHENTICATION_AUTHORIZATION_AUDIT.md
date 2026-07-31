# Authentication & Authorization Audit — System Audit

| Status | **STUB — session model documented elsewhere** |

## Auth model (high level)

- User login via `app/api/auth/login`
- Multi-tenant membership (`Tenant`, user-tenant links)
- Role-based permissions (`lib/accessControl.js`, `lib/seedTenantRoles.js`)
- Admin separation: `lib/adminAuth.js`, `app/insightbooks/**`

## Security governance V2

- Maker-checker: `lib/securityGovernance/domain/segregationOfDuties.js`
- Sessions API: `/api/security-governance/sessions`
- Approvals: `/api/security-governance/approvals`
- API keys: `/api/security-governance/api-keys`

## Audit modules

- `scripts/rbac-audit.js`
- `test/securityGovernance.engine.test.js`

## TO FILL

- Permission matrix per role × module
- OAuth/API key rotation policy evidence
- MFA status (if applicable)

## Related

`docs/accounting-audit/MULTI_TENANT_AND_SECURITY_AUDIT.md`
