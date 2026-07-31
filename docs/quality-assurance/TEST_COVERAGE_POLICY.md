# Test Coverage Policy

Phase 16 policy for measuring and enforcing automated test coverage. **Current state:** no coverage tooling configured (GAP-QA-002).

---

## Objectives

1. Prevent regression in financial kernel (`lib/accountingV2`) and security kernel (`lib/securityGovernance`).
2. Avoid vanity metrics on UI pages until Phase 17 E2E exists.
3. Align thresholds with risk (R-01–06, SEC-1–4, GAP-SEC critical gaps).

---

## Scope

### In scope (coverage measured)

| Path | Rationale | Line threshold (target) |
|---|---|---|
| `lib/accountingV2/**` | Posting, ledger, periods, reports, repair | **70%** |
| `lib/securityGovernance/**` | Policy, SoD, session, audit | **70%** |
| `lib/coaV2/**` | CoA governance, SAL-DUP / 5200 | **65%** |
| `lib/accountingAudit/**` | Phase 1 audit engine | **60%** |

### Out of scope (Phase 16)

| Path | Reason |
|---|---|
| `app/**` pages | E2E in Phase 17 |
| `components/**` | E2E in Phase 17 |
| `prisma/**` | Schema migrations tested via rehearsal |
| Legacy `lib/accountingEngine/**` | Deprecation — shrink over time |

---

## Tooling (target)

```javascript
// vitest.config.js (planned — workstream BA)
coverage: {
  provider: 'v8',
  reporter: ['text', 'lcov', 'json-summary'],
  include: [
    'lib/accountingV2/**',
    'lib/securityGovernance/**',
    'lib/coaV2/**',
    'lib/accountingAudit/**',
  ],
  exclude: ['**/*.test.js', '**/index.js'],
  thresholds: {
    lines: 70,
    functions: 65,
    branches: 60,
    statements: 70,
  },
},
```

**Commands:**
```bash
npm test -- --coverage          # local
npm run test:coverage           # planned package.json script
```

Status: **NOT_STARTED** (workstreams BA, BB).

---

## Branch rules

| Branch | Policy |
|---|---|
| `main` / `master` | Coverage must not drop >2% vs baseline on in-scope paths |
| `develop` | Report only; no block |
| Feature PRs | Encourage coverage on touched files; soft comment bot |

---

## Exclusions (require waiver)

| Exclusion type | Waiver class | Approver |
|---|---|---|
| Generated code | W-GEN | Tech lead |
| Deprecated legacy posting | W-LEGACY | Tech lead + finance |
| Platform-specific branch | W-PLAT | QA lead |

See `TEST_WAIVER_GOVERNANCE.md`.

---

## Coverage ≠ quality

Mandatory companion artefacts:
- `ACCOUNTING_INVARIANT_CATALOGUE.md` — ACC-INV assertions
- `SECURITY_INVARIANT_CATALOGUE.md` — SEC-INV assertions
- `REQUIREMENT_TEST_TRACEABILITY_MATRIX.md` — finding IDs
- `scripts/verify-accounting-scenario.cjs` — DB invariants

**Minimum bar:** THR-007–016 at 90% scenario coverage regardless of line %.

---

## Baseline (July 2026)

| Metric | Value |
|---|---|
| Test files | 95 |
| Test cases | 869 |
| Coverage tool | None |
| Estimated ACC-INV tested | ~44% fully automated |
| Estimated SEC-INV tested | ~23% fully automated |

Baseline JSON will be committed to `artifacts/quality-assurance/coverage-baseline.json` when BA completes.

---

## Review cadence

| Activity | Frequency |
|---|---|
| Threshold review | Quarterly |
| Baseline update | After each phase exit |
| Untested critical path audit | Sprint (from gap register) |
