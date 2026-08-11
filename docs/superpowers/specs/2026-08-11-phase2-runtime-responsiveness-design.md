# Design: Phase 2 — Runtime Responsiveness (4 GB VPS)

**Date:** 2026-08-11  
**Status:** Approved  
**Depends on:** Phase 1 low-RAM CI (complete)

## Goals

1. Reduce JS downloaded/hydrated on first paint for the heaviest tenant pages.
2. Eliminate duplicate `PrismaClient` construction in API routes (use `@/lib/prisma`).
3. Avoid pulling rarely used heavy modules into critical navigation paths where cheap.

## Decisions

- Order: **A** dynamic imports → **B** Prisma singleton → **C** shared heavy import trim.
- Target pages for A: `app/stock/page.js`, `app/pos/page.js`, `app/expenses/page.js` (and adjacent if same pattern is trivial).
- No product behavior changes; lazy components load on open with existing UI.
- Phase 3 (insightbooks split / Prisma schema) remains out of scope.

## Success criteria

1. Stock/POS/Expenses heavy modals/tools load via `next/dynamic` (ssr: false) where they were static imports.
2. No remaining `new PrismaClient()` under `app/api/**` (except intentional rare cases documented).
3. App still builds/runs; no intentional UX regressions.
