# Permission Audit — Admin Control Plane

**Audited:** 2026-07-28  
**Evidence:** `lib/admin/permissions.js`, `lib/admin/adminNav.js`, route guards via `getAdminFromRequest`

## Permission model

- Admin roles / permission keys in `SYSTEM_ADMIN_PERMISSIONS`
- Nav items gated by `requiredPermission` (or arrays)
- API routes must call `getAdminFromRequest` + permission checks (spot-check: platform billing, MRA EIS admin)

## Existing permission families (representative)

| Family | Examples | Scope |
|--------|----------|-------|
| Dashboard / overview | overview access | PLATFORM_GLOBAL |
| Tenants / users | tenant CRUD, user management | PLATFORM_GLOBAL ops on TENANT_SCOPED data |
| Billing / plans | platform billing, mraPlans.* | PLATFORM_GLOBAL |
| MRA EIS admin | centre, terminals, mappings, configuration | PLATFORM_GLOBAL + TENANT_SCOPED ops |
| Affiliates | affiliate management | PLATFORM_GLOBAL |
| Support access | grant/revoke impersonation | SECURITY_RESTRICTED |
| Email / settings | platform email | PLATFORM_GLOBAL |
| Android releases | release management | PLATFORM_GLOBAL |

## Missing for Intelligence + CRM (future)

| Capability | Status |
|------------|--------|
| `intel.executive.read` | NOT_FOUND |
| `intel.revenue.read` | NOT_FOUND |
| `intel.customer.read` | NOT_FOUND |
| `crm.leads.*` | NOT_FOUND |
| `crm.pipeline.*` | NOT_FOUND |
| `crm.activities.*` | NOT_FOUND |
| `support.tickets.*` | NOT_FOUND |
| Sales-team / lead-owner scoping | NOT_FOUND |

## COA permission check

- No admin permission solely for removed System Chart of Accounts page (nav removed; route stub only).
- Tenant CoA permissions remain on tenant plane.

## Nav map gaps (evidence)

Billing children (`/billing/overview`, `/plans`, `/subscriptions`, `/invoices`, `/payments`, `/credits`, `/reconciliation`) are in `adminNav` but several are **missing** from `NAV_PERMISSION_MAP`. AdminSidebar treats unmapped href as visible → billing group can appear without `billing.view`.

## Risks

| Risk | Mitigation for later phases |
|------|-----------------------------|
| Over-broad “admin sees all tenants” for analytics exports | Separate export permissions + audit |
| Support access conflated with sales CRM | Keep SECURITY_RESTRICTED distinct from CRM |
| Permission drift between nav and API | Require same key on both; add tests |
| Unmapped nav href → always visible | Complete `NAV_PERMISSION_MAP` for every adminNav href (Phase 2) |
