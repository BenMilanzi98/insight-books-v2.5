# Navigation Audit

**Date:** 2026-07-25

## Tenant
`components/Sidebar/Sidebar.js` — permission-gated expandable sections. Destinations must be preserved.

## Issues
- Some pages remount Sidebar (tax, HR) despite shell — DUPLICATED.
- Active states via pathname matching — KEEP logic, polish styles.
- Mobile drawer incomplete a11y — REFACTOR.

## Platform
Separate `AdminSidebar` / `AdminAppBar` — STANDARDISE tokens, KEEP structure.
