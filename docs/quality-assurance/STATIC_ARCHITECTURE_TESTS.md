# Static Architecture Tests

Lightweight source scans that fail CI when critical boundaries regress. **Implemented** in `test/qa/architecture/static.boundaries.test.js`.

---

## What is checked

| Test | Source file | Assertion |
|---|---|---|
| Audit append-only | `lib/securityGovernance/application/auditService.js` | No update/delete; `AUDIT_APPEND_ONLY` |
| Session signing v2 | `lib/sessionCookie.js` | `v2.` prefix, HMAC |
| Tenant API prefixes | `lib/tenantApiAccess.js` | V2 + security routes listed |
| Advisory never posts | `threeStatementEngine.js`, `assessmentEngine.js` | `neverPostsToGl` declared |
| No focused tests | All `test/**/*.js` | No `test.only` / `it.only` / `describe.only` |

---

## What is NOT checked (deferred)

| Check | Gap | Phase |
|---|---|---|
| Middleware catalogue completeness | GAP-QA-005, `middleware-catalogue.test.js` | 17 |
| All `/api` routes in manifest | GAP-QA-018, BS | 17 |
| Import boundary (app → lib only) | — | Optional |
| No direct Prisma in pages | — | Optional |

---

## Running

```bash
npm run test:qa
# or
npx vitest run test/qa/architecture/static.boundaries.test.js
```

Included in `test:pr-fast` and `test:invariants`.

---

## Adding new checks

1. Add `it(...)` to `static.boundaries.test.js` with `read('lib/...')` string match.
2. Prefer **behavioural** tests in domain suites over brittle regex when logic is complex.
3. Document new invariant link in `SECURITY_INVARIANT_CATALOGUE.md` or `ACCOUNTING_INVARIANT_CATALOGUE.md`.

---

## Related documents

- `TARGET_TEST_ARCHITECTURE.md`
- `CI_QUALITY_GATES.md` — Gate G3 (planned middleware)
- `FINAL_PHASE_16_REPORT.md`

---

## Document status

| Field | Value |
|---|---|
| Version | 1.0 |
| Last updated | July 2026 |
| Owner | CA (architecture workstream) |
