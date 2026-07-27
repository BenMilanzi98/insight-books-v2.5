# Admin Navigation Architecture

## Current nav (AdminSidebar) — REFACTOR

Single group **Administration**:

| Label | Href | Disposition |
|-------|------|-------------|
| Dashboard | `/insightbooks/dashboard` | KEEP |
| Tenant Management | `/insightbooks/tenant-management` | KEEP |
| User Management | `/insightbooks/user-management` | KEEP |
| Global Settings | `/insightbooks/global-settings` | KEEP path; REIMPLEMENT page |
| System chart of accounts | `/insightbooks/chart-of-accounts` | **REMOVE** |
| Android app | `/insightbooks/mobile-app` | KEEP |
| Affiliate Management | `/insightbooks/affiliate` | KEEP |
| Billing & Subscriptions | `/insightbooks/billing` + children | KEEP structure; invoices/payments rebuild |
| Email Management | `/insightbooks/email-management` | KEEP |
| MRA EIS Entitlement | `/insightbooks/mra-eis` | KEEP / EXTEND children |
| Audit & Security | `/insightbooks/audit` | KEEP; link security children |

**Not in sidebar today but exist:** affiliate-system, audit-logs, security/*, dashboard/*, tenants/[id]/dashboard, subscription-payment, mra-eis/*.

## Target information architecture

```
Operations
  Dashboard
  Tenant Management
  User Management
  Email Management

Commercial
  Billing → Overview, Subscriptions, Invoices*, Payments*
  Affiliate

Product
  Android app
  MRA EIS → Centre, Configuration, Catalogue, Mappings, Terminals
    (tenant detail via drill-in, not top-level)

Trust
  Audit
  Security → Monitoring, Compliance

Platform
  Global Settings
```

\* Invoices/Payments visible only when PlatformInvoice ships (Phase 5); until then omit or badge “Unavailable”.

## Config module shape (target)

```js
// e.g. lib/admin/adminNavigation.js
{
  id, label, href?, icon,
  permission?: 'systemAdmin.tenants.view' | 'system.eis.view' | ...,
  children?: [...],
  flags?: { hideUntil: 'platformBilling' }
}
```

Rules:

- No emoji in config.
- No CoA entry.
- No affiliate-system / audit-logs.
- Preserve **href strings** of canonical pages (`tenant-management`, not `/tenants`).

## Permission filtering

| Role | Behavior |
|------|----------|
| Super Admin | All items |
| Scoped Admin | Filter by `adminHasPermission` / EIS helpers |
| Missing permission | Hide item (do not show disabled clutter) |

## Nested EIS

Prefer in-section subnav on `/insightbooks/mra-eis/*` plus optional sidebar children once Phase 4 lands — avoid dumping all EIS links at root depth in Phase 2.

## Redirect map (nav cleanup)

| Legacy | Target |
|--------|--------|
| `/insightbooks/chart-of-accounts` | `/insightbooks/dashboard?notice=coa-removed` |
| `/insightbooks/affiliate-system` | `/insightbooks/affiliate` |
| `/insightbooks/audit-logs` | `/insightbooks/audit` |
| `/admin/*` | `/insightbooks/*` (existing middleware) |
