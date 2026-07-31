# Route Inventory — `/insightbooks`

**Audited:** 2026-07-28  
**Evidence:** `app/insightbooks/**/page.js` glob (48 page files)

## Existing routes (present)

| Route | Classification | Notes |
|-------|----------------|-------|
| `/insightbooks` | `REUSE` | Entry |
| `/insightbooks/login` | `KEEP` | Admin auth |
| `/insightbooks/dashboard` | `EXTEND` | Control-tower KPIs (recent rebuild) |
| `/insightbooks/dashboard/revenue-overview` | `INCOMPLETE` · `DISCONNECTED` | Stub landing — not in adminNav; redirects users to main surfaces |
| `/insightbooks/dashboard/subscription-analytics` | `INCOMPLETE` · `DISCONNECTED` | Stub — not in adminNav |
| `/insightbooks/dashboard/subscription-growth` | `INCOMPLETE` · `DISCONNECTED` | Stub — not in adminNav |
| `/insightbooks/dashboard/user-analytics` | `INCOMPLETE` · `DISCONNECTED` | Stub — not in adminNav |
| `/insightbooks/dashboard/system-logs` | `INCOMPLETE` · `DISCONNECTED` | Stub — not in adminNav |
| `/insightbooks/dashboard/system-performance` | `INCOMPLETE` · `DISCONNECTED` | Stub — not in adminNav |
| `/insightbooks/tenant-management` | `KEEP` | Tenants |
| `/insightbooks/tenants/[id]/dashboard` | `REUSE` | Tenant drill-down |
| `/insightbooks/user-management` | `KEEP` | Platform users |
| `/insightbooks/global-settings` | `KEEP` | Settings |
| `/insightbooks/feature-entitlements` | `KEEP` | Feature flags |
| `/insightbooks/mobile-app` | `KEEP` | Android releases |
| `/insightbooks/affiliate` | `KEEP` | Affiliates |
| `/insightbooks/affiliate/commissions` | `KEEP` | |
| `/insightbooks/affiliate/payouts` | `KEEP` | |
| `/insightbooks/affiliate-system` | `DUPLICATED` / verify | Legacy parallel entry? |
| `/insightbooks/billing` | `KEEP` | Billing hub |
| `/insightbooks/billing/overview` | `KEEP` | |
| `/insightbooks/billing/plans` | `KEEP` | Core plans |
| `/insightbooks/billing/mra-eis-plans` | `KEEP` | MRA EIS commercial plans |
| `/insightbooks/billing/subscriptions` | `KEEP` | |
| `/insightbooks/billing/invoices` | `KEEP` | Platform invoices |
| `/insightbooks/billing/payments` | `KEEP` | Platform payments |
| `/insightbooks/billing/credits` | `KEEP` | Credits & refunds |
| `/insightbooks/billing/reconciliation` | `KEEP` | |
| `/insightbooks/subscription-payment` | `DISCONNECTED` · `UNSAFE?` | Orphan (not in adminNav); mixes admin + tenant-flavored `/api/subscription/payment` |
| `/insightbooks/email-management` | `KEEP` | |
| `/insightbooks/email-management/templates` | `KEEP` | |
| `/insightbooks/email-management/suppression` | `KEEP` | |
| `/insightbooks/imports` | `KEEP` | Dry-run imports |
| `/insightbooks/reports` | `INCOMPLETE` / verify | Platform reports surface |
| `/insightbooks/mra-eis` | `KEEP` | Entitlements |
| `/insightbooks/mra-eis/centre` | `KEEP` | Platform overview |
| `/insightbooks/mra-eis/terminals` | `KEEP` | |
| `/insightbooks/mra-eis/configuration` | `KEEP` | |
| `/insightbooks/mra-eis/mappings` | `KEEP` | |
| `/insightbooks/mra-eis/catalogue` | `KEEP` | |
| `/insightbooks/mra-eis/tenants/[tenantId]` | `KEEP` | |
| `/insightbooks/audit` | `KEEP` | |
| `/insightbooks/audit-logs` | `DUPLICATED` / verify | Parallel audit UI? |
| `/insightbooks/security` | `KEEP` | |
| `/insightbooks/security/monitoring` | `KEEP` | |
| `/insightbooks/security/compliance` | `KEEP` | |
| `/insightbooks/system-health` | `KEEP` | |
| `/insightbooks/chart-of-accounts` | `KEEP` (stub only) | **Redirects** to dashboard; must not reintroduce UI |

## COA removal verification

| Check | Result | Evidence |
|-------|--------|----------|
| Admin nav contains COA | **No** | `lib/admin/adminNav.js` + `test/systemAdmin.shellNav.test.js` |
| `REMOVED_ADMIN_ROUTES` | **Yes** | `['/insightbooks/chart-of-accounts']` |
| Page still exists | **Stub redirect** | `app/insightbooks/chart-of-accounts/page.js` → `redirect('/insightbooks/dashboard?notice=coa-removed')` |
| Tenant COA intact | **Yes** | `app/chart-of-accounts/page.js` |
| `REMOVED_ADMIN_ROUTES` runtime | **Test-only** | Helper not used by layout/middleware; live guard is page redirect |
| System CoA APIs | **Still present** | `app/api/admin/system-coa/**` retained for ops/seeding (no UI) |

## Nav / permission gaps (from forensic route audit)

| Issue | Class | Evidence |
|-------|-------|----------|
| Billing child hrefs missing from `NAV_PERMISSION_MAP` | `UNSAFE` | Unmapped href → AdminSidebar treats as visible |
| Sidebar `masterAdmin` lists dead `/insightbooks/internal-business/*` | `DISCONNECTED` | Pages do not exist |
| Sidebar still links `affiliate-system`, `audit-logs` | `DISCONNECTED` | Redirect stubs; drift from adminNav |

## Target routes from PRD (NOT implemented)

All of the following are **`NOT_FOUND`** as pages under `/insightbooks` today:

- `/insightbooks/intelligence/**`
- `/insightbooks/customers/**` (beyond tenant-management)
- `/insightbooks/customer-success/**`
- `/insightbooks/support/**`
- `/insightbooks/crm/**`
- `/insightbooks/marketing/**`

See PRD §3 in `Inteligence & Leads.txt` for the full target tree.

## Navigation sources

| Source | Role | Classification |
|--------|------|----------------|
| `lib/admin/adminNav.js` + `components/AdminSidebar` | Canonical AdminShell nav | `KEEP` |
| `components/Sidebar/Sidebar.js` (`masterAdmin` section) | Tenant app sidebar with admin links | `DUPLICATED` / risk of drift |

## Safe implementation order (routes)

1. Keep extending existing billing / tenant / MRA EIS / security surfaces  
2. Phase 2: shared admin foundation (already partially present)  
3. Later: `/intelligence/*` then `/crm/*` as new route trees — do not overload `/dashboard` with CRM
