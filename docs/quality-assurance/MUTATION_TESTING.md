# Mutation Testing

Assessment of mutation testing for InsightBooks V2. **Status: NOT_STARTED — deferred with waiver.**

---

## Decision (Phase 16)

Mutation testing is **not configured** in CI or local dev. Rationale:

1. **Priority:** Close GAP-QA-001 (55 failing tests) and expand HTTP integration first.
2. **Cost:** Stryker/Vitest mutation runs are slow on 869+ case suite.
3. **Coverage:** No baseline line coverage yet (GAP-QA-002) — mutation without coverage is low signal.

**Waiver class:** W-OPTIONAL — revisit in Phase 17 after coverage thresholds (BB) land.

---

## Target scope (when adopted)

| Path | Priority | Rationale |
|---|---|---|
| `lib/accountingV2/domain/posting*.js` | High | R-03 idempotency |
| `lib/securityGovernance/domain/authorization*.js` | High | SEC-INV authz |
| `lib/financialPlanning/domain/money.js` | High | Decimal parsing |
| `test/qa/helpers/moneyAssert.js` | Medium | Assert quality |

**Exclude:** `app/**`, legacy `accountingEngine`, generated Prisma client.

---

## Tooling candidates

| Tool | Notes |
|---|---|
| `@stryker-mutator/vitest-runner` | Fits existing Vitest stack |
| Manual " mutant review" | Catalogue ACC-INV rows without tool |

---

## Entry criteria for Phase 17 spike

1. `npm run test:coverage` exists and meets 70% on accountingV2.
2. `test:pr-fast` stable on main for 2 weeks.
3. Dedicated CI job (non-blocking) with mutation score report artifact.

---

## Related documents

- `TEST_COVERAGE_POLICY.md`
- `PHASE_17_READINESS.md`
- `TEST_WAIVER_GOVERNANCE.md`

---

## Document status

| Field | Value |
|---|---|
| Version | 1.0 |
| Last updated | July 2026 |
| Owner | Mutation testing (deferred) |
