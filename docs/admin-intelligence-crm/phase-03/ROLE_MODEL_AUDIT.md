# Role Model Audit

## Current

- Single `Admin.role` string (default `"Super Admin"`).
- `ADMIN_ROLES`: Super Admin, Billing Administrator, Security Administrator, Compliance Administrator, Platform Auditor, Platform Support.
- No seeded permission matrix per role label — non–Super Admin depends on JSON `permissions`.
- No multi-role, temporary roles, or assignment approvals.
- Tenant `Role` via `/api/admin/roles` is **tenant** RBAC, not platform Admin roles.

## PRD target roles (`Inteligence & Leads.txt` Phase 3)

Executive · Finance · Customer Success · Sales Manager · Salesperson · Technical Administrator · Auditor

## Classification

| Piece | Class |
|-------|-------|
| Role string field | EXTEND → assignments table |
| ADMIN_ROLES operational labels | KEEP as templates |
| PRD visibility roles | ADD as versioned templates (scaffold intel/crm perms only) |
| Multi-role / temp / approvals | REIMPLEMENT (additive models) |

See [TARGET_ROLE_PERMISSION_MATRIX.md](./TARGET_ROLE_PERMISSION_MATRIX.md).
