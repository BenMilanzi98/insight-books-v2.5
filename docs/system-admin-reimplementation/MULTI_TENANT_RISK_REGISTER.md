# Multi-Tenant Risk Register (System Admin)

Platform admin is intentionally cross-tenant. Risks below are about **unsafe or unclear** cross-tenant behavior, not the existence of global admin.

| ID | Risk | Evidence | Severity | Classification | Phase |
|----|------|----------|----------|----------------|-------|
| MT-01 | `/api/admin/invoices` lists tenant AR invoices globally | `prisma.invoice.findMany` with optional `tenantId` filter | High | CROSS_TENANT_RISK / DUPLICATE_BILLING_RISK | 5 |
| MT-02 | CoA apply can mutate tenant accounts | `system-coa/apply`, `tenant-accounts` | Critical | CROSS_TENANT_RISK | 1 |
| MT-03 | CoA migration across tenants | `coa-migration` | Critical | CROSS_TENANT_RISK | 1 |
| MT-04 | `AdminTenantAccess` not enforced on most routes | Model exists; APIs ignore scoped access | High | CROSS_TENANT_RISK / INCOMPLETE | 3–4 |
| MT-05 | Tenant delete cascade blast radius | `tenants/delete` + Prisma cascades | Critical | CROSS_TENANT_RISK / SECURITY_RISK | 1–3 |
| MT-06 | Per-tenant EIS page without consistent entitlement checks | `mra-eis/tenants/[tenantId]` — mitigated by EIS perms but must stay strict | High | CROSS_TENANT_RISK | 4 |
| MT-07 | Admin tenant dashboard `tenants/[id]/dashboard` | Cross-tenant view by id | Medium | CROSS_TENANT_RISK | 3 |
| MT-08 | Bulk email with tenant targeting | `EmailLog.tenantId` optional; mis-send risk | Medium | CROSS_TENANT_RISK | 3 |
| MT-09 | Subscription update/delete by id without tenant confirmation UX | `subscriptions/update|delete` | Medium | CROSS_TENANT_RISK | 3 |
| MT-10 | Affiliate referral links tenants | Correct domain; ensure affiliate ops cannot reassign tenant ownership unsafely | Medium | CROSS_TENANT_RISK | 3 |
| MT-11 | Security sessions APIs may span tenants | `security/sessions*` | Medium | CROSS_TENANT_RISK / INCOMPLETE | 6 |
| MT-12 | Reports/analytics aggregate without row-level audit of who viewed which tenant PII | `reports`, `analytics` | Medium | CROSS_TENANT_RISK | 6 |
| MT-13 | Confusion: system CoA vs tenant `/chart-of-accounts` | Dual surfaces | Medium | CROSS_TENANT_RISK (operator error) | 1 (UI remove) |

## Controls required

1. **Explicit tenant context** on every mutating admin action (confirm modal with tenant name + id).
2. **Audit** all cross-tenant writes to `AdminAuditLog`.
3. **Permission** splits: global Super Admin vs scoped `AdminTenantAccess` (Phase 3+).
4. **Never** present tenant AR `Invoice` as platform billing.
5. CoA apply/migrate: Super Admin + dual control / runbook; not in general nav.

## Positive patterns to KEEP

- Middleware isolates `/insightbooks` from tenant session cookies conceptually (admin_token).
- MRA EIS entitlement services refuse tenant self-entitle; Super Admin / `system.eis.*` required.
- `AccountSubscription.tenantId` indexed and explicit.
