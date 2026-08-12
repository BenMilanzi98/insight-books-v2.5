# Design: Tenant app POS theming unification (drift-only)

**Date:** 2026-08-12  
**Status:** Approved (Approach 1)  
**Scope:** Tenant app only — exclude Admin / `insightbooks`

## Goal

Make every remaining tenant page, modal, button, and link/highlight follow the same POS visual language. Do not rewrite business logic. Do not restyle pages that already match. Do not stop until a final drift scan finds no remaining indigo/violet/purple chrome or flat-card outliers in tenant UI.

## Locked decisions

| Topic | Choice |
|-------|--------|
| Scope | **A** — Tenant app only; Admin/`insightbooks` out |
| Already-themed pages | **A** — Leave matching pages alone; fix drift only |
| Dashboard accents | **A** — Bring Dashboard + filter menus fully onto POS blue/sky |
| Approach | **1** — Shared chrome first + module drift sweeps |

## Visual contract (POS language)

| Element | Standard |
|--------|----------|
| Canvas | Existing `.tenant-shell-canvas` via AppShell |
| Panels/cards | Glass: `bg-white/80 backdrop-blur`, `rounded-2xl`, soft border, top accent bar blue→sky→indigo — or shared `Card` / `tenant-glass-card` |
| Primary button | Brand/POS blue (`Button` or `var(--action-primary)`); darker hover; focus `var(--focus-ring)` |
| Secondary | White/glass outline, gray border, light hover |
| Danger | Red destructive |
| Success CTA | Green gradient only for transactional complete/pay actions (POS Complete Sale pattern) |
| Links / selected chips | Blue text / `blue-50` + blue border/ring — not indigo/violet |
| Inputs | Soft border; blue focus (or shared `Input`) |
| Modals | Shared `Dialog` / `ConfirmDialog` when the shell is clearly a modal; blue accent bar; no purple headers |
| Menus | `DashboardMenuPanel` and similar → blue/sky accents |
| Nav | Leave `.nav-item.active` unchanged |

**Out of contract:** Admin shell, intentional status colors, charts, PDF/print.

## Source of truth

- Tokens / canvas: `app/globals.css` (brand vars, `.tenant-shell-canvas`, `.tenant-glass-card`, `.ib-modal-*`)
- Shared UI: `components/ui/{Card,Button,Dialog,FormField,StatCard,...}`
- Visual reference: `app/pos/page.js` (glass + blue accent + blue actions + green complete CTA)
- Shell: `components/shell/AppShell.jsx`

## Drift rules

**Fix:**
- Flat opaque cards → glass + accent / `Card`
- Indigo/violet/purple CTAs, headers, menu bars, selected chips → POS blue/sky
- One-off primaries missing focus rings → shared `Button` or equivalent classes
- Legacy modal scrims / plain boxes → `Dialog`/`ConfirmDialog` when shell is clear
- Inconsistent link/highlight colors → blue selected language
- Dashboard menus indigo→violet → blue/sky

**Leave alone:**
- Pages already matching POS glass + blue
- Admin / `insightbooks`
- Status semantics, charts, print/PDF
- Business logic, APIs, permissions, table column logic
- POS page big-bang rewrite (only touch if shared primitive changes require it)

**Safety:**
- Chrome/class/component swaps only — no layout/behavior rewrites
- One wave at a time; smoke main routes after each wave
- No commits unless user asks

## Wave order

| Wave | Focus |
|------|--------|
| 0 | Shared primitives polish if needed; `DashboardMenuPanel` → blue/sky |
| 1 | Dashboard |
| 2 | Sales docs still drifting (invoices/quotations/credit notes) — skip already-good chrome |
| 3 | Purchases / Expenses / Stock / Clients |
| 4 | Accounting (CoA, journals, GL, trial balance, bank rec) |
| 5 | HR + Tax |
| 6 | Rentals, Assets, Equity, Budget/Forecast, Reports, Loan readiness, etc. |
| 7 | Settings / Account / Profile / leftover modals & highlights |
| 8 | Repo-wide drift scan (`indigo`/`violet`/`purple` accents, flat cards) + fix stragglers until clean |

## Success criteria

- Tenant UI reads as one POS-aligned theme (glass + blue/sky, consistent buttons/modals/links)
- Dashboard no longer purple/indigo-dominant
- Admin unchanged
- Already-matched modules untouched unless a scan finds real drift
- Wave 8 scan reports no remaining tenant chrome outliers (or documents accepted exceptions)

## Self-review

- No placeholders; waves and rules are concrete.
- Scope excludes Admin; drift-only matches “don’t mess up anything.”
- Does not require rewriting POS itself as a prerequisite.
- Final Wave 8 satisfies “don’t stop until everything follows.”
