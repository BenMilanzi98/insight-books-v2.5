# Conversion Security Matrix

| Control | Requirement | Present today | Class |
|---------|-------------|---------------|-------|
| SoD request vs approve vs execute | Distinct permissions | NOT_FOUND | NOT_FOUND |
| Human-gated execute | Never silent from acceptance | Honesty boundaries yes | CORRECT_AND_REUSABLE boundary |
| Scope filtering | Owner/team/territory | Stub `mode: 'all'` | CROSS_TENANT_RISK |
| Invitation token | Hash only; expiry/revoke | NOT_FOUND | NOT_FOUND / PRIVILEGED_USER_RISK |
| No Super Admin Tenant users | Forbidden | Must enforce Wave 2 | FORBIDDEN |
| No raw passwords in responses | Forbidden for conversion invites | Admin create returns temp password | PRIVILEGED_USER_RISK |
| Idempotency conflict | Fail visibly | NOT_FOUND conversion | NOT_FOUND |
| No AI provision decisions | Forbidden | Absent | FORBIDDEN |
