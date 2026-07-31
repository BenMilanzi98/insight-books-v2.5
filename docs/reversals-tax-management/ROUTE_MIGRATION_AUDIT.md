# Route Migration Audit

## Locked redirects (after nav/guards)
| From | To | Notes |
|------|-----|-------|
| `/tax-types` | `/tax-management` | Hub dashboard; codes at `/tax-management/tax-codes` |
| `/tax-accounts` | `/tax-management/accounts` | Preserve `:id` → `/tax-management/accounts/:id` |
| `/tax` | `/tax-management` | Duplicate hub (Wave 1 cleanup) |

## Sequence
1. Stand up nested pages (thin wrappers)
2. Update Sidebar, tenantPageAccess, setup wizard, deep links
3. Add permanent redirects in `next.config.mjs`
4. Keep old page modules for import reuse (no abrupt delete)

## Deep links to update
- `components/Sidebar/Sidebar.js` (static + dynamic)
- `lib/setupWizardStepsMeta.js` taxes step
- `app/stock/page.js` "Create tax types" link
- `app/rentals/RentalsClient.js` href already `/tax-management` (OK)

## APIs
Keep `/api/tax-types/*`, `/api/tax-accounts/*`, `/api/tax/settle` during dual-run. New hub pages call existing APIs.
