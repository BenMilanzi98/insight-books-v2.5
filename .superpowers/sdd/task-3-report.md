# Task 3 Report: Sidebar — three hubs + redirects + route permissions

**Status:** DONE  
**Date:** 2026-08-11  
**Commits:** none

## Summary

Collapsed Rental & Hiring sidebar to three hub links (Rentals, Hirings, Reports). Deep-link routes remain permission-gated but hidden from nav. Legacy `/rentals/hiring` and `/rentals/inbound-hiring` redirect to Hirings tabs; stub hub pages prevent 404s until Task 4/5.

## Changes Made

### `components/Sidebar/Sidebar.js`

- **masterAdmin** expandable `subItems`, **`rental` group**, and dynamic **`rentalSubItems`**: now only `/rentals`, `/rentals/hirings`, `/rentals/reports`
- **`NAV_ROUTE_PERMISSION_OVERRIDES`**: added `/rentals/hirings` and `/rentals/reports`; kept deep-link entries (`/rentals/hiring`, `/rentals/contracts-v2`, `/rentals/quotations-v2`, `/rentals/reconcile`, `/rentals/inbound-hiring`)

### `next.config.mjs`

- Redirects: `/rentals/hiring` → `/rentals/hirings?tab=customer`, `/rentals/inbound-hiring` → `/rentals/hirings?tab=supplier` (non-permanent)

### Page redirects (query-string fallback)

- `app/rentals/hiring/page.js` — server `redirect()` to customer tab
- `app/rentals/inbound-hiring/page.js` — server `redirect()` to supplier tab (replaces full UI until Task 4 extracts component)

### Stub hub pages

- `app/rentals/hirings/page.js` — “Coming soon” placeholder
- `app/rentals/reports/page.js` — “Coming soon” placeholder

## Verification

- Linter: no errors on modified files
- Manual sidebar check: not run in this session (dev server running; requires authenticated session)

## Concerns

1. **Inbound-hiring UI removed** — page is now a redirect stub; Task 4 must extract and wire supplier tab UI.
2. **Dual redirect paths** — both `next.config.mjs` and page-level `redirect()` exist; page redirect wins for App Router and preserves `?tab=` reliably.
3. **Stub pages** — Hirings/Reports show placeholder until Task 4/5 replace them.

## Follow-up fix (inbound-hiring UI extraction)

**Status:** DONE (no commit)

Restored supplier-hiring UI from `git show HEAD:app/rentals/inbound-hiring/page.js` into `components/rentals/InboundHiringPanel.jsx` (`export default function InboundHiringPanel`). Kept `PermissionGuard` and all `/api/hiring-v2/*` calls unchanged.

- `app/rentals/inbound-hiring/page.js` — still redirects to `/rentals/hirings?tab=supplier`
- `app/rentals/hirings/page.js` — wired via `components/rentals/HiringsHub.jsx`: `?tab=supplier` renders `InboundHiringPanel`; default/customer tab shows Task 4 placeholder note
- Customer tab (`?tab=customer`) still placeholder until Task 4 extracts quantity-rental UI
