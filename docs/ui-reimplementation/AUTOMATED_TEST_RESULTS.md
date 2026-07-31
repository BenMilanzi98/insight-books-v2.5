# Automated test results — UI primitives

**Date:** 2026-07-25  

| Check | Command | Result |
|-------|---------|--------|
| UI primitives | `npx vitest run test/ui.primitives.test.js` | **8 passed** |
| Production build | `npx next build` | **Passed** (after restoring missing budget-forecast service export aliases required by existing API routes) |

Coverage in suite:

- Badge / StatusBadge tone + text
- Button loading / disabled / aria-busy
- EmptyState title + action
- DataTable desktop table + mobile cards + empty state
- Card / SummaryCard
- FormField label ↔ input association

Manual responsive/a11y smoke: [RESPONSIVE_SMOKE_CHECKLIST.md](./RESPONSIVE_SMOKE_CHECKLIST.md).

