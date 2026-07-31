# Exact Decimal Testing

Phase 16 policy: **money authority is bigint minor units**, not JavaScript `number` or `toBeCloseTo`.

---

## Canonical helpers

**File:** `test/qa/helpers/moneyAssert.js`

| Function | Role |
|---|---|
| `parseToMinor(decimalString)` | `"2500.50"` → `250050n` (re-exports `lib/financialPlanning/domain/money.js`) |
| `minorToDecimalString(bigint)` | Display for failure messages |
| `expectMinorEqual(actual, expected, label?)` | Vitest assert on bigint |
| `sumMinors(values[])` | Exact sum for TB checks |
| `expectBalancedDebitsCredits(debits, credits)` | Journal balance helper |

**Journal assertions:** `test/qa/helpers/journalAssert.js` — `assertJournalBalances`, `assertBalanceSheetEquation`, `assertNeverPostsToGl`.

---

## Factory convention

`test/qa/factories/journalFactory.js` builds lines with:

- `debit` / `credit` as `bigint`
- `debitMinor` / `creditMinor` as string mirrors

Amounts passed as decimal strings: `{ amount: '1000000.00' }`.

---

## Legacy drift (known)

These files still use `toBeCloseTo` (workstream AM inventory):

| File | Context |
|---|---|
| `accountingV2.reports.test.js` | KPI ratios, Excel export |
| `coaRollupInventory.test.js` | Balance rollups |
| `loanReadiness.engine.test.js` | DSCR ratios |
| `saleItemBaseQuantity.test.js` | Unit conversion |

**New tests under `test/qa/**` must use `expectMinorEqual`.** Phase 17 may migrate legacy files.

---

## Anti-patterns

| Avoid | Use instead |
|---|---|
| `expect(x).toBeCloseTo(y, 2)` for money | `expectMinorEqual` |
| `Number('1000000.00')` for GL totals | `parseToMinor` |
| Floating arithmetic on totals | `sumMinors` |

---

## Related documents

- `ACCOUNTING_INVARIANT_CATALOGUE.md` — ACC-INV-002 journal balance
- `FINAL_PHASE_16_REPORT.md` — exact decimal confirmation
- `TEST_COVERAGE_POLICY.md`

---

## Document status

| Field | Value |
|---|---|
| Version | 1.0 |
| Last updated | July 2026 |
| Owner | AM (toBeCloseTo inventory) |
