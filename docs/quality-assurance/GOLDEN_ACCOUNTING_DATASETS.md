# Golden Accounting Datasets

Versioned structural fixtures for regression-safe accounting scenarios. **Dataset A implemented; B–D deferred.**

---

## Dataset A — Basic service business ✅

| Field | Value |
|---|---|
| ID | `GOLDEN_A_BASIC_SERVICE` |
| Fixture | `test/qa/golden/datasetA.expected.json` |
| Test | `test/qa/golden/datasetA.basicService.test.js` |
| Currency | MWK |

**Transactions modeled:**

| Event | Amount | Accounts |
|---|---|---|
| Capital contribution | 1,000,000.00 | Dr 1000 / Cr 3000 |
| Cash sale | 150,000.00 | Dr 1000 / Cr 4000 |
| Expense | 45,000.00 | Dr 5100 / Cr 1000 |

**Assertions:** journal balance, TB debits = credits, balance sheet equation (`assets = liabilities + equity`).

**Note:** Illustrative structural golden — not a live GL rebuild from production.

---

## Planned datasets (deferred — Phase 17)

| ID | Business profile | Primary invariants | Status |
|---|---|---|---|
| **B** | Retail + inventory + COGS | Stock movement, 5000 rollup | NOT_STARTED |
| **C** | Multi-owner equity | CAP-005, EQT-035, SoD | NOT_STARTED |
| **D** | Loan + liability lifecycle | AP-004, LRD-017, no advisory GL | NOT_STARTED |

---

## Conventions

1. JSON fixture + Vitest file pair under `test/qa/golden/`.
2. Amounts as decimal strings; assertions via `moneyAssert.js`.
3. `resetIdSequence(100)` in golden tests for stable IDs.
4. Bump `version` in fixture when changing expected minors.

---

## Related documents

- `TEST_DATA_ARCHITECTURE.md`
- `DEFECT_REGRESSION_CATALOGUE.md` — REG-CAP-005, REG-EXP-5000
- `FINAL_PHASE_16_REPORT.md`

---

## Document status

| Field | Value |
|---|---|
| Version | 1.0 |
| Last updated | July 2026 |
| Owner | Golden dataset workstream (CB) |
