# Target Route Architecture

## Rule: keep existing canonical paths

Do **not** invent parallel routes that duplicate established names:

| Keep (canonical) | Do not invent |
|------------------|---------------|
| `/insightbooks/tenant-management` | `/insightbooks/tenants` (list) — detail `tenants/[id]/dashboard` may remain |
| `/insightbooks/user-management` | `/insightbooks/users` |
| `/insightbooks/affiliate` | `/insightbooks/affiliates` |
| `/insightbooks/email-management` | `/insightbooks/email` |
| `/insightbooks/global-settings` | `/insightbooks/settings` |
| `/insightbooks/mobile-app` | `/insightbooks/android` |
| `/insightbooks/billing/subscriptions` | `/insightbooks/subscriptions` |

Legacy `/admin/*` continues to redirect to `/insightbooks/*` via middleware.

## Target route table

| Path | Status | Notes |
|------|--------|-------|
| `/insightbooks/login` | KEEP | Unshelled |
| `/insightbooks` | KEEP / STANDARDISE | Prefer redirect to dashboard |
| `/insightbooks/dashboard` | KEEP | Hub + `notice` banners |
| `/insightbooks/dashboard/*` | EXTEND / thin | Analytics children; SaaS-labeled only |
| `/insightbooks/tenant-management` | KEEP | Primary tenant ops |
| `/insightbooks/tenants/[id]/dashboard` | KEEP / EXTEND | Drill-in only |
| `/insightbooks/user-management` | KEEP / EXTEND | |
| `/insightbooks/global-settings` | REIMPLEMENT in place | Same path |
| `/insightbooks/chart-of-accounts` | REMOVE → redirect | `dashboard?notice=coa-removed` |
| `/insightbooks/mobile-app` | KEEP | |
| `/insightbooks/affiliate` | KEEP | Canonical |
| `/insightbooks/affiliate-system` | REMOVE → redirect | → `affiliate` |
| `/insightbooks/billing` | KEEP | Section root |
| `/insightbooks/billing/overview` | REIMPLEMENT / wire | |
| `/insightbooks/billing/subscriptions` | KEEP | |
| `/insightbooks/billing/invoices` | REIMPLEMENT | After PlatformInvoice |
| `/insightbooks/billing/payments` | REIMPLEMENT | After platform payments |
| `/insightbooks/subscription-payment` | REFACTOR | Clarify; avoid duplicate nav |
| `/insightbooks/email-management` | KEEP | |
| `/insightbooks/audit` | KEEP | Canonical |
| `/insightbooks/audit-logs` | REMOVE → redirect | → `audit` |
| `/insightbooks/security` | KEEP / EXTEND | |
| `/insightbooks/security/monitoring` | KEEP / EXTEND | |
| `/insightbooks/security/compliance` | EXTEND | |
| `/insightbooks/mra-eis` | KEEP | |
| `/insightbooks/mra-eis/centre` | KEEP | |
| `/insightbooks/mra-eis/configuration` | KEEP | |
| `/insightbooks/mra-eis/catalogue` | KEEP | |
| `/insightbooks/mra-eis/mappings` | KEEP | |
| `/insightbooks/mra-eis/terminals` | KEEP | |
| `/insightbooks/mra-eis/tenants/[tenantId]` | KEEP | |

## API path policy (aligned)

Keep `/api/admin/*` prefix. Prefer:

- Harden existing routes over renaming.
- Exception: split billing — introduce `/api/admin/platform-invoices` (or similar) rather than overloading tenant AR `/api/admin/invoices`.
- system-coa routes **remain** after UI removal.

## Tenant app boundaries (do not move)

| Tenant path | Relation |
|-------------|----------|
| `/chart-of-accounts` | Tenant ledger — KEEP; unrelated to admin CoA redirect |
| Tenant billing/checkout | Separate from admin `billing/*` |

## Redirect implementation preference

1. Next.js redirect in `chart-of-accounts/page.js` or `next.config` redirects array.
2. Same for affiliate-system / audit-logs.
3. Preserve query `notice=coa-removed` only for CoA.

## Success check

- 36 page files reduced or redirected such that **primary nav** has no stubs/duplicates/CoA.
- Bookmarks to old CoA URL land on dashboard with notice.
- No new competing path names for the same feature.
