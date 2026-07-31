# API Security Audit — System Audit

| Status | **STUB — per-route review PENDING** |
| Scope | 681 API routes (inventory artifact) |

## Methodology (planned)

1. Classify routes: public / authenticated / admin / cron-secret
2. Verify tenant scoping on every mutating handler
3. Check IDOR patterns (e.g. supplier, journal, invoice by ID)
4. Map to DEF-SEC-* regression suites in `docs/quality-assurance/DEFECT_REGRESSION_CATALOGUE.md`

## Known gaps (evidenced)

| ID | Gap | Test status |
|---|---|---|
| DEF-SEC-002 | Supplier IDOR | NOT_STARTED |
| DEF-SEC-003 | Open reversal endpoint | NOT_STARTED |
| DEF-SEC-004 | Capital routes session-only | NOT_STARTED |

## Existing coverage

- `test/authz.test.js`
- `test/qa/invariants/security.invariants.test.js`
- `test/qa/multi-tenant/isolation.matrix.test.js`
- V2 posting tenant isolation: REG-TEN-POST-001

## TO FILL

- Route × auth matrix spreadsheet
- Penetration test results (if any)
