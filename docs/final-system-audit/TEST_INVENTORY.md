# Test Inventory

| Field | Value |
|---|---|
| Test files | **141** |
| Generated | 2026-07-23T10:22:17.109Z |

## Critical suites (accounting integrity)

- `test/accountingV2.postingEngine.test.js`
- `test/accountingV2.reports.test.js`
- `test/accountingV2.ledger.test.js`
- `test/coaRollupInventory.test.js` (CAP double-count)
- `test/qa/regression/defect.regressions.test.js` (REG-CAP-005 et al.)
- `test/qa/invariants/accounting.invariants.test.js`
- `test/mraEis.*.test.js` (Phases 19–21)

## Evidence from this audit pass

- Core posting + CoA + most report tests: **PASS**
- `accountingV2.reports` Excel export test: observed **TIMEOUT** at 5s (non-integrity flake; see defect register)
- Full suite / production forensic / E2E every-route: **NOT COMPLETED in this pass**

## Rule

Do not skip failing financial tests to green CI. Do not treat compile success as reconciliation success.
