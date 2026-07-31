# Current UI Audit

**Date:** 2026-07-25

## Executive summary

InsightBooks V2 has a production-capable feature surface (~188 pages) but **no unified design system**. Visual language is approximately indigo + slate via Tailwind utility classes and a large `app/globals.css`, with module-local exceptions (HR CSS blocks, emerald report loaders, mixed icon packs).

| Area | Classification |
|------|----------------|
| Brand indigo / slate sidebar | KEEP |
| Geist fonts (Next) | KEEP — must apply on `body` |
| `RootLayoutClient` shell | REFACTOR / EXTEND |
| `Sidebar` / `AppBar` | EXTEND |
| `globals.css` class library | STANDARDISE (dedupe conflicts) |
| Feature modals (26) | CONSOLIDATE chrome onto Dialog |
| Tables / badges / empty states | STANDARDISE |
| Dark mode | NOT_APPLICABLE (light only) |

## Critical / High UI gaps (pre-refresh)

1. **INCONSISTENT typography** — Geist vars set; `body` uses Arial.
2. **DUPLICATED CSS** — `.btn-primary`, `.empty-state`, `.status-badge` redefined with different rules.
3. **NON_RESPONSIVE risk** — many tables/forms are desktop-first; shell mobile drawer lacks focus trap.
4. **OVERFLOWING risk** — page padding + wide tables; long business names in header.
5. **INACCESSIBLE** — many icon-only controls; modals without consistent focus management.
6. **PERFORMANCE_RISK** — large globals.css; chart libs; no table virtualisation standard.

## Non-negotiable preserve list

Routes, permissions, APIs, posting, calculations, nav destinations, workflow actions.
