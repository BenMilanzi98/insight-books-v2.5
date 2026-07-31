# Report UI

`app/reports-v2/page.js` — the V2 reporting workspace, deployed alongside the
legacy `/reports` page during the rollout comparison window (§72); it becomes
the canonical `/reports` at cutover.

## Layout

- **Category sidebar** — Core Accounting (Trial Balance, Income Statement,
  Statement of Financial Position, Cash Flow, Statement of Changes in
  Equity), Receivables & Payables (aging + control reconciliations),
  Operations & Controls (Inventory, Fixed Assets, Payroll, Loans, Taxes,
  Equity), Management (Budget vs Actual). Each card shows name and
  description; integrity status appears on generation.
- **Scope controls** — date range / as-of date, branch, comparative window,
  include-zero-balances; all sent server-side, nothing calculated in the
  browser.
- **Report header** — business, report title, financial window, currency,
  integrity status badge (VERIFIED green / warnings amber / UNVERIFIED red /
  BLOCKED), warning summary with rule codes, generation time and user.
- **Report body** — hierarchy-indented lines with account codes and names;
  every populated line expands to its per-account breakdown (code, name,
  amount, comparative, variance) satisfying §55; account rows open the
  drill-down modal (GL activity → journal lines with journal references).
- **Actions** — export CSV / Excel / PDF (server-generated from the same
  envelope), print via browser print of the same rendered result.

Negative values render in parentheses; totals come exclusively from the
server envelope (client-side totals are never authoritative); zero-balance
visibility is a user toggle. Warnings and exception disclosures are always
rendered — never hidden in print.
