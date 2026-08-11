# Tenant Summary Stat Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify tenant summary/KPI tiles on the `/invoice` visual language via one `StatCard` family (interactive + static), with Phase 1 page migrations.

**Architecture:** New canonical `components/ui/StatCard.jsx` owns chrome and modes. `ClickableStatCard` and `SummaryCard` become thin wrappers. Phase 1 pages drop local/ad-hoc KPI markup in favor of these primitives. Admin cards stay untouched.

**Tech Stack:** React (Next.js App Router), Tailwind, Lucide icons, Vitest + `react-dom/server` (`renderToStaticMarkup`) matching `test/ui.primitives.test.js`.

## Global Constraints

- Visual chrome locked to invoice: `rounded-2xl`, `border-white/50`, `bg-white/80`, `shadow-lg`, `backdrop-blur-sm`, gradient top bar, uppercase label, bold tabular `break-words` value (never truncate money).
- Interactive mode = `<button>`; static mode = `<div>` (no click hint).
- Do not change `AdminSummaryCard` or `/insightbooks` admin cards.
- Do not mass-rename caller props; map in wrappers (`title`→`label`, etc.).
- Sync mirrored files under `insight/` when changing shared UI or phase-1 pages that exist there.
- Do not commit unless the user explicitly asks.

---

## File map

| File | Responsibility |
|------|----------------|
| `components/ui/StatCard.jsx` | Canonical card (create) |
| `components/ui/ClickableStatCard.jsx` | Interactive wrapper |
| `components/ui/Card.jsx` | `SummaryCard` → static StatCard |
| `components/ui/index.js` | Export `StatCard` |
| `components/budget-forecast/BfShell.js` | Domain SummaryCard uses StatCard for both modes |
| `test/ui.primitives.test.js` (+ optional `test/statCard.test.js`) | Contract tests |
| Phase 1 pages | Migrate local/ad-hoc KPI strips |

---

### Task 1: StatCard primitive + tests

**Files:**
- Create: `components/ui/StatCard.jsx`
- Modify: `test/ui.primitives.test.js`
- Test: `test/ui.primitives.test.js`

**Interfaces:**
- Produces: `export default function StatCard({ label, value, count, countLabel, icon, active, onClick, title, className, valueClassName, iconWrapClassName, barClassName, interactive, children })`
- `interactive` default `false` → render `div`
- `interactive={true}` → render `button` with existing ClickableStatCard behavior/hints

- [ ] **Step 1: Write failing tests** in `test/ui.primitives.test.js`:

```js
import StatCard from '../components/ui/StatCard.jsx';
import ClickableStatCard from '../components/ui/ClickableStatCard.jsx';

it('StatCard static mode renders a div without click hints', () => {
  const html = renderToStaticMarkup(
    React.createElement(StatCard, { label: 'Paid', value: 'MWK 1,000' })
  );
  expect(html).toContain('Paid');
  expect(html).toContain('MWK 1,000');
  expect(html).toContain('rounded-2xl');
  expect(html).toContain('break-words');
  expect(html).not.toContain('<button');
  expect(html).not.toContain('Click to open');
});

it('StatCard interactive mode renders a button with hint', () => {
  const html = renderToStaticMarkup(
    React.createElement(StatCard, {
      label: 'Pending',
      value: 'MWK 500',
      interactive: true,
      onClick: () => {},
    })
  );
  expect(html).toContain('<button');
  expect(html).toContain('Click to open');
});

it('SummaryCard uses invoice chrome via StatCard', () => {
  const html = renderToStaticMarkup(
    React.createElement(SummaryCard, { title: 'Revenue', value: '1,000', subtitle: 'MTD' })
  );
  expect(html).toContain('Revenue');
  expect(html).toContain('1,000');
  expect(html).toContain('MTD');
  expect(html).toContain('rounded-2xl');
  expect(html).not.toContain('<button');
});
```

- [ ] **Step 2: Run tests — expect FAIL** (StatCard missing / SummaryCard still old chrome)

```bash
npx vitest run test/ui.primitives.test.js
```

- [ ] **Step 3: Implement `StatCard.jsx`** by lifting logic from current `ClickableStatCard.jsx`, branching on `interactive`:
  - Static: outer `div`, no hint line, no `aria-pressed`
  - Interactive: outer `button`, hints + Active badge as today
  - Shared: gradient bar, label, value classes, icon chip, count/children

- [ ] **Step 4: Rewire wrappers**
  - `ClickableStatCard.jsx` → `return <StatCard interactive {...props} />`
  - `Card.jsx` `SummaryCard` → map props into static `StatCard` (`title`→`label`, combine `subtitle`/`trend` into children or a hint row; render `actions` below)
  - `components/ui/index.js` → `export { default as StatCard } from './StatCard';`

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx vitest run test/ui.primitives.test.js
```

- [ ] **Step 6: Sync** `insight/components/ui/{StatCard.jsx,ClickableStatCard.jsx,Card.jsx,index.js}` and `insight/test/ui.primitives.test.js` if those paths exist

---

### Task 2: BfShell SummaryCard static path

**Files:**
- Modify: `components/budget-forecast/BfShell.js`
- Sync: `insight/components/budget-forecast/BfShell.js` if present

**Interfaces:**
- Consumes: `StatCard` (or `ClickableStatCard` for onClick path)
- Produces: same `SummaryCard({ label, value, hint, onClick, active, title })` export

- [ ] **Step 1:** When `onClick` present, keep `ClickableStatCard` (or `StatCard interactive`).
- [ ] **Step 2:** When no `onClick`, replace the slate `div` with:

```jsx
<StatCard label={label} value={value} title={title}>
  {hint ? <span className="mt-1 block text-xs text-gray-500">{hint}</span> : null}
</StatCard>
```

Or pass hint via `countLabel` if that matches existing BF pages.

- [ ] **Step 3:** Spot-check `/budget-forecast/budgets` cards still render.

---

### Task 3: Expenses KPI strip → ClickableStatCard

**Files:**
- Modify: `app/expenses/page.js` (~1890–1980)
- Sync: `insight/app/expenses/page.js` if present

- [ ] **Step 1:** Import `ClickableStatCard` if missing.
- [ ] **Step 2:** Replace inline `<button>...gradient bar...</button>` map with:

```jsx
<ClickableStatCard
  key={card.key}
  label={card.label}
  value={`MK ${card.amount}`}
  count={card.count}
  countLabel={card.countLabel}
  active={isActive}
  onClick={() => { /* existing filter toggle logic */ }}
  valueClassName={card.amountClass}
  barClassName={card.barClass}
/>
```

- [ ] **Step 3:** Remove unused per-card `shadowClass` / `activeRing` if only used by old markup.
- [ ] **Step 4:** Manual: `/expenses` card filter still toggles.

---

### Task 4: Purchases local SummaryCard removal

**Files:**
- Modify:
  - `app/purchases/suppliers/page.js`
  - `app/purchases/receipts/page.js`
  - `app/purchases/bills/page.js`
  - `app/purchases/orders/page.js`
  - `app/purchases/payments/page.js`
- Sync matching `insight/app/purchases/**` copies if present

- [ ] **Step 1:** Delete each local `function SummaryCard({ label, value, helper })`.
- [ ] **Step 2:** Import shared static card:

```js
import StatCard from '@/components/ui/StatCard';
// usage:
<StatCard label={label} value={value}>
  {helper ? <span className="mt-1 block text-xs text-gray-500">{helper}</span> : null}
</StatCard>
```

Or map `helper` → children / countLabel consistently across all five files.

- [ ] **Step 3:** Grep confirm no `function SummaryCard` under `app/purchases/`.

```bash
rg "function SummaryCard" app/purchases
```

Expected: no matches.

---

### Task 5: Dashboard revenue/expense KPI tiles

**Files:**
- Modify: `app/dashboard/page.js` (~1445–1496)
- Sync: `insight/app/dashboard/page.js` if present

- [ ] **Step 1:** Import `StatCard`.
- [ ] **Step 2:** Replace the two ad-hoc Total Revenue / Total Expenses frosted cards with static `StatCard`s:
  - `label`, `value` (keep skeleton when loading via `value` prop or children)
  - `icon` (CreditCard / ShoppingCart) with tone via `barClassName` / `iconWrapClassName`
  - Put change % / “from last …” into `children`
- [ ] **Step 3:** Do **not** migrate chart panels, expandable sections, or alert lists.
- [ ] **Step 4:** Manual: `/dashboard` still shows revenue/expense amounts and % change.

---

### Task 6: Verify already-aligned Phase 1 consumers

**Files (verify only unless broken):**
- `app/invoice/page.js`
- `app/quotations/page.js`
- `app/clients/page.js`
- `app/stock/page.js`
- `app/accounting/receivables/page.js`
- `app/accounting/payables/page.js`

- [ ] **Step 1:** Confirm they import `@/components/ui/ClickableStatCard` (wrapper → StatCard).
- [ ] **Step 2:** No code change required if wrappers are correct.
- [ ] **Step 3:** Quick visual smoke on `/invoice` filter cards.

---

### Task 7: Regression + Phase 1 exit gate

- [ ] **Step 1:** Run:

```bash
npx vitest run test/ui.primitives.test.js
```

Expected: PASS

- [ ] **Step 2:** Grep local summary helpers in phase-1 targets:

```bash
rg "function SummaryCard" app/purchases app/expenses components/budget-forecast
```

Expected: no local SummaryCard left in purchases; BfShell may still export named SummaryCard (domain API OK).

- [ ] **Step 3:** Confirm `AdminSummaryCard.jsx` unchanged.
- [ ] **Step 4:** Update spec status line to “Phase 1 implemented” in `docs/superpowers/specs/2026-08-10-tenant-summary-stat-cards-design.md`.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Canonical StatCard | 1 |
| Interactive + static modes | 1 |
| ClickableStatCard wrapper | 1 |
| SummaryCard remapped | 1 |
| BfShell | 2 |
| Expenses | 3 |
| Purchases local cards | 4 |
| Dashboard KPI strips | 5 |
| Invoice/quotations/clients/stock | 6 |
| Exports | 1 |
| Admin out of scope | 7 |
| Phase 2 deferred | noted (no task) |

## Out of this plan (Phase 2)

Reversals, remaining accounting/HR ad-hoc tiles, any other tenant pages not listed above — same StatCard, later pass.
