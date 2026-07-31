# Target Role × Permission × Scope Matrix

**Status:** Locked v1 (Phase 3)  
**Catalogue version:** `platform-authz-2026-07-28`

Legend: **F** = full · **R** = read · **M** = masked finance · **—** = deny · **S** = scaffold (intel/crm keys only; no business UI)

## Platform roles (templates)

| Role code | Display | Scope default | Notes |
|-----------|---------|---------------|-------|
| `SUPER_ADMIN` | Super Admin | PLATFORM_GLOBAL | Break-glass |
| `TECHNICAL_ADMIN` | Technical Administrator | PLATFORM_GLOBAL | Health, mobile, settings (non-billing) |
| `SECURITY_ADMIN` | Security Administrator | SECURITY_RESTRICTED | Sessions, monitoring, impersonation review |
| `BILLING_ADMIN` | Billing Administrator | PLATFORM_GLOBAL (billing) | Plans/subs/invoices; SoD on approve |
| `FINANCE_VIEWER` | Finance | PLATFORM_GLOBAL | Billing/finance read + export; metrics |
| `COMPLIANCE_ADMIN` | Compliance Administrator | PLATFORM_GLOBAL | Audit, compliance |
| `PLATFORM_AUDITOR` | Platform Auditor / Auditor | PLATFORM_GLOBAL | Read-only audit + reports |
| `PLATFORM_SUPPORT` | Platform Support | TENANT via support session | Tenants view + supportAccess |
| `CUSTOMER_SUCCESS` | Customer Success | TENANT allow-list | Tenants/users view; no billing mutate |
| `EXECUTIVE` | Executive | PLATFORM_GLOBAL | Dashboard overview + masked/aggregate finance |
| `SALES_MANAGER` | Sales Manager | SALES_TEAM (future) | Scaffold CRM perms only |
| `SALESPERSON` | Salesperson | LEAD_OWNER (future) | Scaffold CRM perms only |

## Permission families (summary)

| Family | EXEC | FIN | CS | BILL | SEC | TECH | AUD | SUP | SALES* |
|--------|------|-----|----|------|-----|------|-----|-----|--------|
| dashboard.view | R | R | R | R | R | R | R | R | R |
| dashboard.financialMetrics | M | F | — | F | — | — | R | — | — |
| dashboard.securityMetrics | — | — | — | — | F | R | R | — | — |
| dashboard.operationalMetrics | R | R | R | R | R | F | R | R | — |
| tenants.view | R | R | F | R | R | R | R | F | R |
| tenants.supportAccess | — | — | — | — | R | — | — | F | — |
| tenants.mutate (create/edit/suspend…) | — | — | — | — | — | — | — | — | — |
| users.* | — | — | R | — | F | F | R | R | — |
| billing.view | R | F | — | F | — | — | R | — | — |
| billing.*.manage / approve | — | — | — | F† | — | — | — | — | — |
| billing.reports.export | — | F | — | F | — | — | R | — | — |
| audit.view / export | — | — | — | — | R | — | F | — | — |
| security.* | — | — | — | — | F | — | R | — | — |
| health.* | — | — | — | — | R | F | R | — | — |
| affiliates.* | — | R | — | F | — | — | R | — | — |
| email.* | — | — | — | — | — | F | R | — | — |
| mraEntitlement.* / mraPlans.* | — | R | R | F | — | F | R | R | — |
| intel.*.read | S | S | S | S | — | — | S | — | S |
| crm.* | S | — | — | — | — | — | — | — | S |

† SoD: creator ≠ approver for invoices where both keys held — enforced in Wave 3.

\* Sales roles: permissions registered; routes remain feature-flagged/hidden until CRM phase.

## Super Admin

All permissions. Break-glass audited.

## Custom roles

Allowed only as clones of templates with **subset** grants; cannot exceed ceiling of assigner’s grants; cannot grant Super Admin without dual control.
