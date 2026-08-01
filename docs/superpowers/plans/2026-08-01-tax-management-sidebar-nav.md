# Tax Management Sidebar Nav Implementation Plan

> **For agentic workers:** Implement task-by-task. Do not commit unless the user asks.

**Goal:** Move Tax Management horizontal tabs into an expandable sidebar list; remove the top tab bar.

**Spec:** `docs/superpowers/specs/2026-08-01-tax-management-sidebar-nav-design.md`

## File map

| File | Change |
|------|--------|
| `components/Sidebar/Sidebar.js` | Expandable Tax Management + subItems (static + permissioned builders) |
| `lib/i18n/navLabelMap.js` | Map new sub-item English labels to `navigation.*` keys |
| `app/tax-management/layout.js` | Remove TaxManagementNav |
| Delete `components/tax/TaxManagementNav.js` | Unused after layout change |

### Task 1: Sidebar expandable Tax Management

- [x] Replace single Tax Management link with expandable + subItems (both static config and permissioned push)
- [x] Add NAV_LABEL_MAP entries for tax sub-labels
- [x] Remove TaxManagementNav from layout; delete component
- [x] Prefix-aware sub-item active/expand (without Dashboard matching all children)
