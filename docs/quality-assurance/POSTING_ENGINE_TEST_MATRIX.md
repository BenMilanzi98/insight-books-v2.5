# Posting Engine Test Matrix

Maps **posting paths**, **event types**, and **test coverage** for Accounting V2 and legacy adapters. Based on `test/accountingV2.postingEngine.test.js`, `test/accountingV2.posting.test.js`, `test/accountingV2.integrations.test.js`, and Phase 1 posting matrix risks R-22–R-25.

---

## V2 kernel (`executePosting` / event registry)

| Capability | Test file | Cases | Status |
|---|---|---|---|
| Balanced journal validation | `accountingV2.postingEngine.test.js` | multiple | ✅ |
| Idempotency / duplicate event | same | P2002, race | ✅ |
| Idempotency key conflict | same | | ✅ |
| Cross-tenant account reject | same | SEC-1 / TEN-001 | ✅ |
| Feature flags / posting mode | same | | ✅ |
| Transaction boundary rollback | same | | ✅ |
| Template definitions (5200 payroll) | same + `accountingMappingRules.test.js` | | ✅ |
| Opening balance posting | `accountingV2.integrations.test.js` | | ✅ |
| Repair HREP posting | `accountingV2.repair.test.js` | | ⚠️ failing |
| Period close posting hooks | `accountingV2.periods.test.js` | | ⚠️ |

---

## Retired API (`postAccountingEvent`)

| Block | File | Status |
|---|---|---|
| Idempotency | `accountingV2.posting.test.js` | **skipped** |
| Transaction boundary | same | **skipped** |
| Tenant isolation | same | **skipped** |
| Shadow accounting | same | **skipped** |
| Shadow invoice | `accountingV2.postingEngine.test.js` | **skipped** |

**Replacement:** `postingEngine.test.js` — see `FLAKY_AND_SKIPPED_TEST_REGISTER.md`.

---

## Legacy `postGlEntry` (removed)

| Caller area | Test file | Status |
|---|---|---|
| Core engine | `accountingEngine.test.js` | **FAILING** — expects success, gets `LEGACY_POSTING_REMOVED` |
| Inventory write-off | `inventoryWriteOffJournal.test.js` | **FAILING** |
| Payroll reversal | `payrollReversalLegacyRoot.test.js` | **FAILING** |
| Expense GL | `expenseGlPosting.test.js` | review needed |
| Invoice reversal integration | `invoiceReversalGl.integration.test.js` | partial |

**Gap:** GAP-QA-013 — migrate to V2 adapters or update tests to assert removal.

---

## Integration adapters (by module)

| Module | Test file | Event types covered | Status |
|---|---|---|---|
| Sales / invoice | `accountingV2.integrations.test.js` | INVOICE_POSTED, payments | ✅ |
| Expenses | `expenseGlPosting.test.js` | Expense | ⚠️ legacy |
| Payroll | `malawiTaxUtilsPayroll.test.js` | 5200 mapping | ✅ |
| Supplier purchase/payment | `accountingEngine.test.js` | SupplierPurchase/Payment | **FAILING** |
| Bank reconciliation adjust | `bankReconciliation.completion.test.js` | | ✅ |
| Equity transactions | `equityManagement.workflows.test.js` | | ✅ domain |
| Capital contribution | `capitalContributionAssetRegister.test.js` | | ✅ |
| Inventory write-off | `inventoryWriteOffJournal.test.js` | | **FAILING** |

---

## Risk-linked posting scenarios (R-22 – R-25)

| Risk | Scenario | Test | Status |
|---|---|---|---|
| R-22 | Dual T+J supplier payment | — | ❌ NOT_STARTED |
| R-23 | GR + inventory bill double window | — | ❌ |
| R-24 | Payroll double-post | `malawiTaxUtilsPayroll.test.js` | ⚠️ partial |
| R-25 | POS cash deposit no journal | — | ❌ |
| R-03 | Duplicate race | `postingEngine.test.js` | ✅ |

---

## CoA account conventions in posting tests

| Code | Usage in tests |
|---|---|
| **5200** | Payroll / salary expense template |
| **5000** | COGS / operating header in report fixtures |
| AR / REV / VAT | Standard invoice draft lines in posting tests |

---

## Planned tests (`test/qa/`)

| File | Purpose | Status |
|---|---|---|
| `posting-idempotency-http.test.js` | HTTP double-submit | NOT_STARTED |
| `posting-sec1-legacy-block.test.js` | Legacy path deny foreign account | NOT_STARTED |
| `ledger-dual-write.test.js` | R-01 regression | NOT_STARTED |

---

## Traceability

| Finding | Matrix row |
|---|---|
| SEC-1 | Cross-tenant account reject ✅ |
| R-03 | Idempotency ✅ |
| R-19 | V2 adapter ✅; legacy ❌ |
| SAL-DUP / 5200 | Template + payroll tests ✅ |
| JRN-006 | Duplicate source ✅ |

See `ACCOUNTING_INVARIANT_CATALOGUE.md` ACC-INV-001–010 and `DEFECT_REGRESSION_CATALOGUE.md`.
