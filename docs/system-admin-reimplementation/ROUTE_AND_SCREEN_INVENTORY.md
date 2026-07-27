# Route and Screen Inventory

All **36** `app/insightbooks/**/page.js` routes. Classifications are forensic findings, not aspirational labels.

## Summary counts

| Classification (primary) | Count |
|--------------------------|------:|
| KEEP / EXTEND | 14 |
| STANDARDISE / REFACTOR | 4 |
| STUB / REIMPLEMENT | 8 |
| CONSOLIDATE / REMOVE | 3 |
| INCOMPLETE / DISCONNECTED | 5 |
| LEGACY_READ_ONLY / special | 2 |

(Primary tag only; secondary tags noted in Notes.)

## Full inventory

| # | Path | File | Primary | Secondary | Notes |
|---|------|------|---------|-----------|-------|
| 1 | `/insightbooks` | `page.js` | STANDARDISE | — | Root; typically redirects/lands into dashboard pattern |
| 2 | `/insightbooks/login` | `login/page.js` | KEEP | REFACTOR | Public admin login; outside AdminShell |
| 3 | `/insightbooks/dashboard` | `dashboard/page.js` | EXTEND | STANDARDISE | Main hub; mix of real stats + polish debt |
| 4 | `/insightbooks/dashboard/revenue-overview` | `dashboard/revenue-overview/page.js` | EXTEND | INCOMPLETE | Fetches stats; UX/design debt |
| 5 | `/insightbooks/dashboard/subscription-analytics` | `dashboard/subscription-analytics/page.js` | INCOMPLETE | STUB | Analytics depth uneven |
| 6 | `/insightbooks/dashboard/subscription-growth` | `dashboard/subscription-growth/page.js` | INCOMPLETE | — | Growth charts; validate against real APIs |
| 7 | `/insightbooks/dashboard/system-logs` | `dashboard/system-logs/page.js` | INCOMPLETE | DISCONNECTED | Overlaps audit surfaces |
| 8 | `/insightbooks/dashboard/system-performance` | `dashboard/system-performance/page.js` | INCOMPLETE | STUB | Relies on metrics/performance APIs of mixed quality |
| 9 | `/insightbooks/dashboard/user-analytics` | `dashboard/user-analytics/page.js` | INCOMPLETE | — | Engagement analytics |
| 10 | `/insightbooks/tenant-management` | `tenant-management/page.js` | KEEP | EXTEND | Wired to `/api/admin/tenants` (+ delete) |
| 11 | `/insightbooks/tenants/[id]/dashboard` | `tenants/[id]/dashboard/page.js` | EXTEND | CROSS_TENANT_RISK | Per-tenant admin view; must stay admin-scoped |
| 12 | `/insightbooks/user-management` | `user-management/page.js` | EXTEND | REFACTOR | Users CRUD/actions; roles API still mock |
| 13 | `/insightbooks/global-settings` | `global-settings/page.js` | STUB | REIMPLEMENT | Simulated save; local state only |
| 14 | `/insightbooks/chart-of-accounts` | `chart-of-accounts/page.js` | REMOVE | LEGACY_READ_ONLY→API | Large real editor; **UI removal locked**; APIs KEEP |
| 15 | `/insightbooks/mobile-app` | `mobile-app/page.js` | KEEP | EXTEND | Android rollout / grace / locks |
| 16 | `/insightbooks/affiliate` | `affiliate/page.js` | KEEP | — | Canonical affiliate management |
| 17 | `/insightbooks/affiliate-system` | `affiliate-system/page.js` | REMOVE | STUB | Hardcoded mock affiliates; duplicate |
| 18 | `/insightbooks/billing` | `billing/page.js` | STANDARDISE | — | Billing section entry |
| 19 | `/insightbooks/billing/overview` | `billing/overview/page.js` | INCOMPLETE | DISCONNECTED | Overview not backed by PlatformInvoice |
| 20 | `/insightbooks/billing/subscriptions` | `billing/subscriptions/page.js` | KEEP | EXTEND | Account + EIS + branch subscription ops |
| 21 | `/insightbooks/billing/invoices` | `billing/invoices/page.js` | STUB | DUPLICATE_BILLING_RISK | Fake numbers; API separately reads tenant `Invoice` |
| 22 | `/insightbooks/billing/payments` | `billing/payments/page.js` | STUB | REIMPLEMENT | No platform payment ledger |
| 23 | `/insightbooks/subscription-payment` | `subscription-payment/page.js` | REFACTOR | DUPLICATE_BILLING_RISK | Adjacent payment flow; clarify vs tenant checkout |
| 24 | `/insightbooks/email-management` | `email-management/page.js` | EXTEND | KEEP | Bulk email + history via EmailLog |
| 25 | `/insightbooks/audit` | `audit/page.js` | KEEP | CONSOLIDATE | Real audit + admin-logs fetch |
| 26 | `/insightbooks/audit-logs` | `audit-logs/page.js` | REMOVE | STUB | Mock logs; duplicate of audit |
| 27 | `/insightbooks/security` | `security/page.js` | EXTEND | STANDARDISE | Security hub |
| 28 | `/insightbooks/security/monitoring` | `security/monitoring/page.js` | EXTEND | INCOMPLETE | Events/metrics APIs exist |
| 29 | `/insightbooks/security/compliance` | `security/compliance/page.js` | INCOMPLETE | — | Compliance UI thin vs SecV2 models |
| 30 | `/insightbooks/mra-eis` | `mra-eis/page.js` | KEEP | EXTEND | EIS admin entry |
| 31 | `/insightbooks/mra-eis/centre` | `mra-eis/centre/page.js` | KEEP | EXTEND | Control centre |
| 32 | `/insightbooks/mra-eis/configuration` | `mra-eis/configuration/page.js` | KEEP | EXTEND | Platform configuration |
| 33 | `/insightbooks/mra-eis/catalogue` | `mra-eis/catalogue/page.js` | KEEP | EXTEND | External catalogue |
| 34 | `/insightbooks/mra-eis/mappings` | `mra-eis/mappings/page.js` | KEEP | EXTEND | Mapping support |
| 35 | `/insightbooks/mra-eis/terminals` | `mra-eis/terminals/page.js` | KEEP | EXTEND | Terminal support (metadata) |
| 36 | `/insightbooks/mra-eis/tenants/[tenantId]` | `mra-eis/tenants/[tenantId]/page.js` | KEEP | EXTEND | Per-tenant EIS entitlement/detail |

## Sidebar vs orphan routes

**Linked in AdminSidebar today:** dashboard, tenant-management, user-management, global-settings, chart-of-accounts, mobile-app, affiliate, billing (+ overview/subscriptions/invoices/payments), email-management, mra-eis, audit.

**Exist but weak/missing nav:** affiliate-system, audit-logs, subscription-payment, tenants/[id]/dashboard, dashboard/* children, security/*, mra-eis subroutes (may be in-page nav).

## Target disposition (locked paths)

Do **not** invent parallel paths like `/insightbooks/tenants` for management — keep `tenant-management`.

| Action | Routes |
|--------|--------|
| Redirect + remove UI | `chart-of-accounts` → `dashboard?notice=coa-removed` |
| Redirect to canonical | `affiliate-system` → `affiliate`; `audit-logs` → `audit` |
| Rebuild in place | `billing/invoices`, `billing/payments`, `global-settings` |
| Keep path, harden | All KEEP/EXTEND rows above |
