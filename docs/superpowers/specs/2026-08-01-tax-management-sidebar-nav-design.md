# Tax Management Sidebar Navigation

**Date:** 2026-08-01  
**Status:** Approved  
**Decision:** Flat expandable sidebar under Tax Management; remove horizontal tab bar.

## Problem

Tax Management uses a horizontal scroll tab bar (`TaxManagementNav`) that is hard to scan. Users want those links in the side navbar under **Tax Management**.

## Goals

1. Tax Management is an expandable sidebar item with a flat list of all former tab pages.
2. The horizontal top tab bar is removed entirely.
3. Paths and permissions stay unchanged.

## Design

### Sidebar

When `canAccessRoute("/tax-management")`, add:

- Parent: **Tax Management** (`expandable: true`, `href: "/tax-management"`)
- Sub-items (order preserved from current tabs):

| Label | Path |
|-------|------|
| Dashboard | `/tax-management` |
| Tax codes | `/tax-management/tax-codes` |
| Tax accounts | `/tax-management/accounts` |
| Transactions | `/tax-management/transactions` |
| Periods | `/tax-management/periods` |
| Returns | `/tax-management/returns` |
| Payments | `/tax-management/payments` |
| Refunds | `/tax-management/refunds` |
| Credits | `/tax-management/credits` |
| Withholding | `/tax-management/withholding` |
| Reconciliation | `/tax-management/reconciliation` |
| Reports | `/tax-management/reports` |
| Import/Export | `/tax-management/import-export` |
| Settings | `/tax-management/settings` |

Use the same expandable pattern as Accounting / Rentals. Auto-expand when a child route is active.

Wire English sub-item labels through `NAV_LABEL_MAP` → existing `navigation.*` keys where available.

Also update the static/demo nav config entry that currently lists Tax Management as a non-expandable link.

### Top nav removal

- Remove `<TaxManagementNav />` from `app/tax-management/layout.js`.
- Delete `components/tax/TaxManagementNav.js` if unused.

### Non-goals

- Nested sidebar groups
- Per-subpage permission splits
- Route renames
- Mobile-only tab bar

## Acceptance

- [ ] Sidebar shows expandable Tax Management with all former tab links.
- [ ] No horizontal tax tab bar on tax-management pages.
- [ ] Visiting a child route expands Tax Management and highlights the matching sub-item.
- [ ] Users without tax-management route access still do not see the menu.
