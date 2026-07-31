# Segregation of Duties Audit

| Area | Finding | Class |
|------|---------|-------|
| Platform billing create vs approve keys | Separate keys exist | KEEP |
| Same-actor hard block | Missing | MISSING |
| Role self-grant Super Admin | Possible via changeRole | PRIVILEGE_ESCALATION_RISK |
| Support self-approval | N/A (auto-ACTIVE) | MISSING |
| Last Super Admin | `superAdminProtection` | KEEP |

**Target:** SoD policy table (e.g. `billing.invoices.create` ⊕ `billing.invoices.approve`); deny self-approval of role grants and support access.
