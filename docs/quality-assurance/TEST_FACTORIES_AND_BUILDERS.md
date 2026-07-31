# Test Factories & Builders

Object builders for Phase 16 QA tests under `test/qa/factories/`.

---

## Journal factory

**File:** `test/qa/factories/journalFactory.js`

| Export | Purpose |
|---|---|
| `buildBalancedJournal(opts)` | Double-entry journal with bigint minors |
| `buildUnbalancedJournal(opts)` | Negative case for ACC-INV-002 |
| `buildReversalOf(journal)` | Reversal with swapped debits/credits |

**Default opts:** `amount: '1000.00'`, `debitAccount: '1000'`, `creditAccount: '4000'`, `business: biz_TEST_001`.

**Used by:** `accounting.invariants.test.js`, `defect.regressions.test.js`, `datasetA.basicService.test.js`.

---

## Actor factory

**File:** `test/qa/factories/actorFactory.js`

| Export | Purpose |
|---|---|
| `buildActor({ business, permissions, userId })` | Authorized actor for security tests |
| `buildOtherBusinessActor()` | Cross-tenant denial cases |

**Used by:** `security.invariants.test.js`.

---

## ID factory

**File:** `test/qa/factories/ids.js`

Deterministic IDs — see `DETERMINISTIC_TIME_AND_IDENTIFIERS.md`.

---

## Planned (not started)

| Factory | File | Owner |
|---|---|---|
| HTTP session client | `test/helpers/httpTestClient.js` | BC |
| QA tenant seed | `test/helpers/qaTenantFactory.js` | BD |

---

## Conventions

1. Factories return **plain objects**, not ORM entities.
2. Amounts as **decimal strings**; conversion via `parseToMinor`.
3. Call `resetIdSequence` in `beforeEach` when IDs matter.
4. Prefix regression tests with catalogue ID in describe title (`REG-CAP-005`, etc.).

---

## Related documents

- `EXACT_DECIMAL_TESTING.md`
- `DEFECT_REGRESSION_CATALOGUE.md` — REG-* naming
- `TEST_DATA_ARCHITECTURE.md`

---

## Document status

| Field | Value |
|---|---|
| Version | 1.0 |
| Last updated | July 2026 |
| Owner | BX (factory workstream) |
