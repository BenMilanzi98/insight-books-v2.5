# Tenant POS Theming Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate remaining tenant-app visual drift so pages, modals, buttons, and link/highlights match the POS blue/sky glass language — without rewriting business logic or restyling already-matching chrome / Admin.

**Architecture:** Approach 1 — polish shared chrome (`DashboardMenuPanel`, shared UI accents) first, then wave through tenant modules fixing only drift (flat cards, indigo/violet/purple CTAs/menus/links, legacy modal shells). Verify each wave with focused `rg` drift scans. Final wave is a repo-wide tenant scan until clean (or documented accepted exceptions).

**Tech Stack:** Next.js App Router, Tailwind v4 via `app/globals.css`, shared `components/ui/*`, existing `.tenant-shell-canvas` / `.tenant-glass-card`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-12-tenant-pos-theming-unification-design.md` — follow locked decisions exactly.
- Tenant app only — **never** restyle `app/insightbooks/**` or Admin shell.
- Drift-only — leave pages that already match POS glass + blue alone.
- Chrome/class/component swaps only — no API, permission, or data-flow changes.
- Dashboard + menus → POS blue/sky (no purple/indigo-dominant chrome).
- Do **not** commit unless the user explicitly asks.
- Do not edit `insight/` duplicates unless a shared root import requires it.
- Prefer shared `Button` / `Card` / `Dialog` when the swap is local and safe; otherwise equivalent POS class recipes.
- Status colors (green/amber/red) and chart series palettes may keep multi-hue for data meaning — do not force every chart bar to blue.

## File map

| File / area | Responsibility |
|-------------|----------------|
| `components/ui/DashboardMenuPanel.jsx` | Shared menu accent → blue/sky |
| `components/UniversalDateRangeFilter.js` | Date-menu CTA accents → blue/sky |
| `components/ui/{Button,Card,Dialog,FormField}.jsx` | Touch only if accent drift remains |
| `app/dashboard/page.js` | Dashboard chrome → POS blue/sky |
| Module pages under `app/**` (excl. `insightbooks`) | Drift fixes per wave |
| Shared components under `components/**` used by tenant modules | Same |
| `app/globals.css` | Optional small utility aliases only if needed; do not break Admin |
| `.superpowers/sdd/theming-drift-log.md` | Per-wave inventory + scan results |

## Shared recipes (use verbatim when swapping)

**Accent bar (POS):**
```text
bg-gradient-to-r from-blue-500 via-sky-500 to-indigo-500
```
(Keep a touch of indigo only as the *end* of the POS bar — never violet/purple.)

**Primary button:**
```text
bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-200
```
or `<Button>` from `components/ui/Button.jsx`.

**Selected chip / link highlight:**
```text
bg-blue-50 border-blue-500 text-blue-700
text-blue-600 hover:text-blue-800 hover:bg-blue-50
```

**Glass panel:**
```text
bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 relative overflow-hidden
```
+ top accent bar, or `<Card accent="blue">`.

**Forbidden in tenant chrome (drift markers):**
```text
from-indigo-500 to-purple-600
via-purple-500
to-violet-500
from-violet-
bg-violet-600
bg-purple-600
```
(Except accepted chart series / status badges documented in the drift log.)

## Drift scan commands

From repo root (PowerShell-friendly):

```bash
# Tenant UI chrome drift (exclude admin + node_modules + .next)
rg -n "from-indigo-|to-purple-|via-purple-|from-violet-|to-violet-|bg-violet-600|bg-purple-600|from-purple-" app components --glob "!insightbooks/**" --glob "!**/.next/**"
```

```bash
# Flat card pattern candidates (manual triage — many false positives)
rg -n "bg-white rounded-lg shadow-sm|bg-white rounded-xl shadow-sm border border-gray-200" app components --glob "!insightbooks/**"
```

---

### Task 0: Shared menu chrome → POS blue/sky

**Files:**
- Modify: `components/ui/DashboardMenuPanel.jsx`
- Modify: `components/UniversalDateRangeFilter.js` (indigo→purple CTA / focus rings)
- Create: `.superpowers/sdd/theming-drift-log.md`

**Interfaces:**
- Produces: POS-aligned `DashboardMenuPanel`, `DashboardMenuChip`, `DashboardMenuItem` used by date filters / invoice menus / etc.

- [ ] **Step 1: Baseline scan (RED inventory)**

Run the forbidden-accent `rg` command above. Append raw hit counts + top paths to `.superpowers/sdd/theming-drift-log.md` under `## Baseline`.

- [ ] **Step 2: Update `DashboardMenuPanel.jsx`**

Replace accents:

```jsx
// Panel bar
<div className="h-1 bg-gradient-to-r from-blue-500 via-sky-500 to-indigo-500" />

// Chip active
'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
// Chip idle hover
'bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:shadow-sm'

// Item active
'bg-gradient-to-r from-blue-50 to-sky-50 text-blue-700 font-medium border border-blue-100'
```

Update the file comment to say POS blue/sky (not indigo→violet).

- [ ] **Step 3: Update `UniversalDateRangeFilter.js`**

Replace:
- `focus:ring-indigo-500 focus:border-indigo-500` → `focus:ring-blue-500 focus:border-blue-500`
- Apply button `from-indigo-500 to-purple-600` / hover purple → `from-blue-500 to-blue-600` / `hover:from-blue-600 hover:to-blue-700`

- [ ] **Step 4: Verify shared consumers still render**

Smoke: open any page using UniversalDateRangeFilter (Dashboard or Invoices). Menu bar must be blue→sky, chips blue when active.

- [ ] **Step 5: Log + no commit**

Append Wave 0 notes to drift log. Do not commit unless user asks.

---

### Task 1: Dashboard → POS blue/sky

**Files:**
- Modify: `app/dashboard/page.js` (chrome only)
- Update: `.superpowers/sdd/theming-drift-log.md`

**Interfaces:**
- Consumes: updated `DashboardMenuPanel` / date filter from Task 0

- [ ] **Step 1: Inventory Dashboard drift**

In `app/dashboard/page.js`, list lines with `indigo|purple|violet` used for **chrome** (headers, CTA buttons, accent bars, link hovers, spinners). Chart multi-color series may stay — mark as accepted in log.

- [ ] **Step 2: Replace chrome accents**

Examples of required swaps (apply consistently across the file):

| From | To |
|------|-----|
| `from-indigo-500 via-purple-500 to-violet-500` accent bars | `from-blue-500 via-sky-500 to-indigo-500` |
| `from-indigo-600 via-blue-600 to-cyan-500` hero | Prefer `from-blue-600 via-sky-600 to-blue-500` (POS blue family) |
| `bg-indigo-600` / `hover:bg-indigo-700` CTAs | `bg-blue-600` / `hover:bg-blue-700` |
| `text-indigo-600` links | `text-blue-600` |
| `hover:bg-indigo-100` / `hover:bg-indigo-50` | `hover:bg-blue-100` / `hover:bg-blue-50` |
| `from-indigo-400 to-purple-500` icon tiles | `from-blue-500 to-sky-600` |
| `border-indigo-600` spinners | `border-blue-600` |
| `bg-purple-100 text-purple-700` business badge | Prefer `bg-blue-100 text-blue-700` (or keep green “single biz” as status) |

Do **not** change metric calculations, fetch calls, or layout structure.

- [ ] **Step 3: Smoke `/dashboard`**

Confirm header, KPIs, quick links, and menus look POS-blue; no purple bars.

- [ ] **Step 4: Log + no commit**

---

### Task 2: Sales docs drift (invoices / quotations / credit notes)

**Files (typical — inventory first):**
- `app/invoice/page.js`, `app/quotations/**`, `app/credit-debit-notes/**`
- Related filter/sort UI that still uses indigo/purple outside shared menu panel

- [ ] **Step 1: Scan sales routes**

```bash
rg -n "indigo|violet|purple" app/invoice app/quotations app/credit-debit-notes components --glob "!insightbooks/**"
```

Skip files that only use remapped indigo already looking brand-blue **and** have glass cards — log as “already matched.”

- [ ] **Step 2: Fix remaining chrome**

- Filter/sort accent bars & chips → POS blue recipes
- Flat toolbar cards → glass + accent if clearly divergent
- Primary CTAs → blue-600 / `Button`
- Selected row/link highlights → blue-50 / text-blue-600

- [ ] **Step 3: Smoke main sales list pages**

- [ ] **Step 4: Log + no commit**

---

### Task 3: Purchases / Expenses / Stock / Clients

**Files:** under `app/purchases/**`, `app/expenses/**`, `app/stock/**`, `app/clients/**` + heavily used components (e.g. `components/Expenses/*`).

- [ ] **Step 1: Scan + triage** (same forbidden-accent + flat-card commands scoped to these dirs)
- [ ] **Step 2: Fix drift only** (CTAs, cards, modals shells, link highlights)
- [ ] **Step 3: Smoke** `/purchases/orders`, `/expenses`, `/stock`, `/clients`
- [ ] **Step 4: Log + no commit**

---

### Task 4: Accounting modules

**Files:** e.g. `components/GeneralLedger.js`, `app/journal-entries/**`, `app/chart-of-accounts/**`, `app/trial-balance/**`, `app/bank-reconciliation/**`, related pages.

Known heavy drift: `components/GeneralLedger.js` (indigo/violet/purple hero and filters).

- [ ] **Step 1: Scan accounting paths**
- [ ] **Step 2: Restyle GeneralLedger hero/filters/links to POS blue/sky glass** (keep filter logic)
- [ ] **Step 3: Fix remaining CoA / journals / TB / bank rec chrome drift**
- [ ] **Step 4: Smoke key accounting routes**
- [ ] **Step 5: Log + no commit**

---

### Task 5: HR + Tax

**Files:** `app/hr/**`, `components/hr/**`, `app/tax*/**`, `app/tax-management/**`

- [ ] **Step 1: Scan + triage** (note: HR status badges using indigo for “Posted” may map to blue-100/blue-800)
- [ ] **Step 2: Fix flat cards / indigo CTAs / link highlights**
- [ ] **Step 3: Smoke main HR payroll + tax hubs**
- [ ] **Step 4: Log + no commit**

---

### Task 6: Remaining hubs

**Files:** rentals (`components/rentals/*`, `app/rentals/**`), assets, equity, budget/forecast, reports, loan-readiness, capital account (`components/CapitalAccountManager.js`), etc.

Known drift: `InboundHiringPanel.jsx`, `HiringsHub.jsx`, `CapitalAccountManager.js`.

- [ ] **Step 1: Scan these areas**
- [ ] **Step 2: Fix tab active states `bg-indigo-600` → `bg-blue-600`; links `text-indigo-600` → `text-blue-600`; violet CTAs → blue**
- [ ] **Step 3: Smoke rentals hubs + one reports page + capital if present**
- [ ] **Step 4: Log + no commit**

---

### Task 7: Settings / Account / Profile + leftover modals

**Files:** `app/account/page.js`, `app/settings/**`, `app/profile/**`, leftover tenant modals still on `bg-black bg-opacity-50` + plain white boxes where easy to swap to `Dialog`.

- [ ] **Step 1: Scan account/settings/profile**
- [ ] **Step 2: Glass cards + blue CTAs/toggles where drifting; migrate obvious modal shells to `Dialog` only when structure is clean**
- [ ] **Step 3: Smoke `/account` and settings entry**
- [ ] **Step 4: Log + no commit**

---

### Task 8: Final tenant drift scan until clean

**Files:** any remaining hits from repo-wide scan (excl. Admin)

- [ ] **Step 1: Run full forbidden-accent scan**

```bash
rg -n "from-indigo-|to-purple-|via-purple-|from-violet-|to-violet-|bg-violet-600|bg-purple-600|from-purple-" app components --glob "!insightbooks/**" --glob "!**/.next/**"
```

- [ ] **Step 2: Classify each hit**

For every hit: **Fix** (chrome) | **Accept** (chart series / status / Admin-adjacent false path) | **Skip** (already POS end-stop indigo in `via-sky-500 to-indigo-500` bar — not a hit if pattern is correct).

- [ ] **Step 3: Fix all Fix-classified hits**

Repeat scan until zero Fix-classified remain.

- [ ] **Step 4: Flat-card triage pass**

Run flat-card `rg`; fix clear outliers; accept intentional dense admin-like settings tables if already on tenant canvas and readable.

- [ ] **Step 5: Write final section in drift log**

Include: scan command, remaining accepted exceptions list, smoke checklist of modules touched.

- [ ] **Step 6: Stop — report to user; do not commit unless asked**

---

## Self-review

1. **Spec coverage:** Waves 0–8 match design; Admin excluded; drift-only; Dashboard blue locked; shared menus first.
2. **Placeholders:** Recipes and scan commands are concrete; module file lists use inventory-first because the dirty tree is large — acceptable for theming sweeps.
3. **Safety:** No business-logic steps; chart/status exceptions called out.
4. **Verification:** Drift scans substitute for classic TDD (visual chrome).

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-12-tenant-pos-theming-unification.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per wave/task, review between tasks  
2. **Inline Execution** — execute waves in this session with checkpoints  

Which approach?
