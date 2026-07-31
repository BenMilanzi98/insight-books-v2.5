# Test Coverage Report — System Audit

| Status | **STUB — file count only; coverage % not measured** |
| Test files | **106** (artifact) |

## Distribution (sample)

| Area | Files |
|---|---|
| Accounting V2 | `accountingV2.*.test.js` (10+) |
| CoA V2 | `coaV2.*.test.js` |
| Bank recon | `bankReconciliation.*.test.js` |
| QA pack | `test/qa/**` (regression, invariants, property, multi-tenant) |
| Legacy domain | expenses, payroll, invoices, COA, reports |

## Known gaps

| Gap | Register |
|---|---|
| Full npm test green | SYS-DEF-001 |
| E2E Playwright | GAP-QA-015 |
| HTTP security suites | DEF-SEC-002–004 |
| Report engine | DEF-REP-* **FAILING** |
| Legacy posting removal | DEF-LEG-POST-* **FAILING** |

## Commands

```bash
npm test                    # full suite — baseline UNKNOWN
npx vitest run test/qa      # QA pack subset
```

## TO FILL

- Istanbul/c8 coverage report if configured
- CI last-run pass/fail counts with commit SHA
