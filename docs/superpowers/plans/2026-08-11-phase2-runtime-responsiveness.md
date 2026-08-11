# Phase 2 Runtime Responsiveness — brief plan (executed)

> Executed 2026-08-11 after design approval.

**Goal:** Faster first load / lower runtime pressure on 4 GB VPS.

## Done

1. **Dynamic imports** — `app/stock/page.js`, `app/pos/page.js`, `app/expenses/page.js` heavy modals/tools via `next/dynamic` (`ssr: false`).
2. **Prisma singleton** — all `app/api/**` `new PrismaClient()` → `@/lib/prisma`.
3. **Trim** — stock billing label inlined so ServiceFormModal is not in the main chunk; expenses COGS/modals/scanner deferred.

## Verify

- `node --check` on the three pages
- Zero `new PrismaClient(` under `app/api`
