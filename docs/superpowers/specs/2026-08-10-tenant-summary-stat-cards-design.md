# Tenant Summary Stat Cards — Unified Design Language

**Date:** 2026-08-10  
**Status:** Phase 1 + Phase 2 implemented  
**Scope choice:** All tenant summary/KPI tiles (clickable + static), invoice visual language  
**Approach:** A — one family, two modes  
**Rollout:** Phased (complete for primary tenant KPI strips)

## Problem

`/invoice` uses a polished shared `ClickableStatCard` (frosted surface, gradient top bar, icon chip, full money amounts). Other tenant modules still mix:

- The same `ClickableStatCard` (already good)
- Design-token `SummaryCard` in `components/ui/Card.jsx` (different look)
- Local one-off `SummaryCard` helpers (e.g. purchases/suppliers)
- Ad-hoc KPI markup on dashboards and list pages

This breaks professionalism and uniformity.

## Goals

1. One visual language for tenant summary/KPI cards, matching `/invoice`.
2. Support both **interactive** (filter/navigate) and **static** (display-only) modes without looking like two different products.
3. Preserve compatibility for existing `ClickableStatCard` and `SummaryCard` imports where practical.
4. Money/KPI values remain fully readable (no ellipsis truncation).

## Non-goals

- Reworking generic content panels (table shells, filter bars, modals).
- Changing `AdminSummaryCard` / `/insightbooks` admin card system.
- Full visual redesign of dashboard charts or non-KPI tiles.
- Big-bang migration of every obscure page in one PR if phase 1 delivers the shared API.

## Canonical component

**File:** `components/ui/StatCard.jsx` (new)

### Visual chrome (locked to invoice)

- `rounded-2xl`, `border-white/50`, `bg-white/80`, `shadow-lg`, `backdrop-blur-sm`
- Gradient top bar (`barClassName`, default brand blue gradient)
- Uppercase tracking label
- Bold tabular value with `break-words` (never truncate money)
- Optional count / hint / children
- Optional Lucide icon in soft rounded chip
- Optional tone helpers via `valueClassName` / `iconWrapClassName` / `barClassName` (as invoice status colors do today)

### Modes

| Mode | `interactive` | Element | Behavior |
|------|---------------|---------|----------|
| Static | `false` (default for SummaryCard path) | `div` | No click hint; no `aria-pressed` |
| Interactive | `true` | `button` | Current ClickableStatCard: `onClick`, `active` ring, “Click to open” / “Click again to clear” hints |

### Primary props

`label`, `value`, `count`, `countLabel`, `icon`, `active`, `onClick`, `title`, `className`, `valueClassName`, `iconWrapClassName`, `barClassName`, `interactive`, `children`

## Compatibility wrappers

1. **`ClickableStatCard.jsx`** — thin wrapper: `interactive` + pass-through props to `StatCard` (no visual fork).
2. **`SummaryCard` in `Card.jsx`** — reimplement on `StatCard` static mode; map `title`→`label`, `subtitle`/`trend`→hint area, keep `icon`/`actions`/`className`. Existing callers keep working with the new look.
3. **`BfShell` `SummaryCard`** — already wraps `ClickableStatCard`; leave as thin domain helper or point at `StatCard` interactive.

Do **not** create a third divergent visual implementation.

## Migration

### Phase 1 (high-traffic tenant modules)

| Area | Action |
|------|--------|
| `/invoice` | Already on ClickableStatCard; ensure wrapper → StatCard |
| `/expenses` | Align KPI strip to StatCard / ClickableStatCard |
| `/stock` | Already uses ClickableStatCard; verify look |
| `/quotations` | Align KPI strip |
| `/clients` | Align KPI / summary tiles |
| `/purchases/suppliers` | Delete local `SummaryCard`; use shared static/interactive StatCard |
| `/payments` (if KPI tiles exist) | Align |
| `/dashboard` KPI strips | Replace ad-hoc metric tiles that match summary-card role |
| `components/budget-forecast/BfShell.js` | Keep API; ensure underlying StatCard |

Sync mirrored files under `insight/` when the project still ships that tree.

### Phase 2

Remaining tenant pages with ad-hoc summary KPI tiles (reversals, accounting modules, HR summaries, etc.) — same components, no new variants.

## Exports

Update `components/ui/index.js` to export `StatCard` (and keep `SummaryCard` / existing Card exports).

## Success criteria

- Phase 1 pages show the same summary-card chrome for static and clickable KPIs.
- No local `function SummaryCard` in phase-1 page files.
- `ClickableStatCard` and `SummaryCard` consumers do not require a mass prop rename.
- Admin summary cards unchanged.
- Manual smoke: `/invoice` filter cards still toggle; a static summary page (suppliers) shows non-button cards with the same surface/bar/typography.

## Risks

- `SummaryCard` prop semantics (`title` vs `label`) — handle via mapping in wrapper only.
- Dashboard has many decorative cards; migrate only true KPI/summary tiles to avoid over-scoping.
- Client component boundary: StatCard used from client pages; keep `'use client'` if interactive, or split if needed for RSC static use.

## Approval record

- Scope: **2** (all summary cards, tenant)
- Approach: **A** (one family, two modes)
- Rollout: **phased**
- Design verbally approved: 2026-08-10
