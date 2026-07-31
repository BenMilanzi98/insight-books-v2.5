# Flaky and Skipped Test Register

Living register of **intentionally skipped**, **conditionally skipped**, and **known flaky** tests. Updated from repo scan July 2026.

---

## Summary

| Category | Files | Cases | CI impact |
|---|---|---|---|
| `describe.skip` (permanent) | 2 | 23 | Pass (skipped) |
| `describe.skipIf` (DB tenant) | 3 | varies | Pass (skipped without DB) |
| Failing (not flaky — real regression) | 13 | 55 | **Fail CI** |
| Floating (`toBeCloseTo`) | 4 | 12 | Pass when suite green |

---

## Permanent skips — retired APIs

### `test/accountingV2.posting.test.js`

| Block | Cases | Reason |
|---|---|---|
| `describe.skip('idempotency and duplicate prevention (retired postAccountingEvent)')` | ~6 | API removed in fresh-books V2-only cutover |
| `describe.skip('transaction boundary (retired postAccountingEvent)')` | ~5 | Same |
| `describe.skip('tenant isolation (retired postAccountingEvent)')` | ~4 | Same |
| `describe.skip('shadow accounting (removed in fresh-books)')` | ~8 | Shadow mode removed |

**Replacement coverage:** `test/accountingV2.postingEngine.test.js` (active idempotency, tenancy, modes).

**Disposition:** GAP-QA-017 — archive or delete after team sign-off (`TEST_WAIVER_GOVERNANCE.md` waiver class **W-SKIP-RETIRED**).

### `test/accountingV2.postingEngine.test.js`

| Block | Reason |
|---|---|
| `describe.skip('shadow invoice posting (removed in fresh-books)')` | Shadow invoice path deleted |

---

## Conditional skips — DB integration

| File | Guard | Tenant | Runs when |
|---|---|---|---|
| `test/expenseCoaCategoryPicker.test.js` | `describe.skipIf(!tenantReady)` | `QA-Accounting` | Local/staging DB with seeded tenant |
| `test/salaryAdvanceGlAccount.test.js` | same | same | same |
| `test/coaExpenseTenantPipeline.test.js` | same | same | same |

**Helper:** `test/helpers/dbIntegrationGuard.js` → `tenantExistsForIntegration()`.

**CI behaviour:** Without `DATABASE_URL` + seed, entire describe blocks skip — **silent loss of coverage** (GAP-QA-014).

**Mitigation plan:**
1. Document in PR template when DB tests are skipped.
2. Staging nightly job with `DATABASE_URL` (Phase 17).
3. Optional: fail CI if skip count > threshold on protected branches.

---

## Known failing suites (not flaky — fix required)

These fail deterministically on `npm test` (July 2026). Track under GAP-QA-001 / GAP-QA-011 / GAP-QA-013.

| File | Failing cases | Likely cause |
|---|---|---|
| `accountingV2.reports.test.js` | ~40 | Fixture/stub drift vs report engine changes |
| `accountingV2.periods.test.js` | 5 | Close workflow API changes |
| `accountingV2.repair.test.js` | 2 | HREP path / 5200 reclass |
| `accountingEngine.test.js` | 4 | `postGlEntry` permanently throws `LEGACY_POSTING_REMOVED` |
| `inventoryWriteOffJournal.test.js` | 2 | Still calls legacy `postGlEntry` |
| `payrollReversalLegacyRoot.test.js` | 1 | Same |
| `coaRouteReconciliation.test.js` | 1 | Dual-ledger aggregate query |
| `incomeStatementOperating*.test.js` | 3 | 5200 rollup mapping |
| `journalAccountSelect.test.js` | 4 | Balance formatter expectation mismatch |
| `taxRateValidation.test.js` | file-level | Import/setup failure |
| `expenseCoaCategoryPicker.test.js` | file-level | DB skip or setup |
| `salaryAdvanceGlAccount.test.js` | file-level | DB skip or setup |

**Policy:** Do **not** quarantine as flaky without 3+ non-deterministic failures across 10 runs (`FLAKY_TEST_POLICY.md`).

---

## Floating-point assertions (stability watch)

| File | Usage | Risk |
|---|---|---|
| `accountingV2.reports.test.js` | KPI ratios, Excel cell values | Low — fixed decimals |
| `coaRollupInventory.test.js` | `toBeCloseTo(..., 5)` on balances | Low |
| `loanReadiness.engine.test.js` | DSCR `toBeCloseTo(..., 2)` | Low |
| `saleItemBaseQuantity.test.js` | Unit qty `toBeCloseTo(..., 6)` | Low |

Not currently flaky; prefer integer minor-unit assertions for new tests.

---

## Planned skips (not yet in repo)

| Planned file | Expected skip pattern |
|---|---|
| `test/qa/playwright-smoke.spec.js` | Skip in CI without browser (Phase 17) |
| `test/qa/migration-rehearsal.test.js` | `skipIf(!process.env.MIGRATION_REHEARSAL)` |

---

## Register maintenance

| Action | Owner | Frequency |
|---|---|---|
| Update after skip/fail change | Author of PR | Each test PR |
| Review skipped inventory | QA lead | Sprint |
| Approve new permanent skip | Tech lead + waiver ID | Before merge |

See `FLAKY_TEST_POLICY.md` and `TEST_WAIVER_GOVERNANCE.md`.
