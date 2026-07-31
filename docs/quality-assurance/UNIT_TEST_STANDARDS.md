# Unit Test Standards

Conventions for Vitest unit tests in InsightBooks V2 (Phase 16 baseline).

---

## File layout

| Pattern | Location | Example |
|---|---|---|
| Domain / lib tests | `test/*.test.js` | `accountingV2.postingEngine.test.js` |
| QA catalogue tests | `test/qa/**/*.test.js` | `invariants/accounting.invariants.test.js` |
| Helpers | `test/helpers/`, `test/qa/helpers/` | `acctV2PrismaStub.js` |
| Factories | `test/qa/factories/` | `journalFactory.js` |

**Discovery:** `vitest.config.js` → `include: ['test/**/*.test.js']` (covers `test/qa/`).

---

## Naming

| Element | Convention |
|---|---|
| File | `{module}.{aspect}.test.js` or `{catalogue}.invariants.test.js` |
| Describe | Catalogue ID when applicable: `REG-CAP-005`, `ACC-INV-002` |
| Skip retired API | `describe.skip(...)` with comment + GAP-QA ticket |

---

## Assertions

| Domain | Standard |
|---|---|
| Money in `test/qa/**` | `expectMinorEqual` — see `EXACT_DECIMAL_TESTING.md` |
| Money in legacy tests | Mixed — migrate to minors in Phase 17 |
| Authorization | `assertAuthorized` / expect thrown domain errors |
| GL structure | `assertJournalBalances`, `assertNeverPostsToGl` |

---

## Mocking

- Use Vitest `vi` for module mocks in domain tests.
- Prefer **in-memory Prisma stub** over mocking every delegate for accounting V2.
- Do not mock `parseToMinor` — test real decimal parsing.

---

## Skip policy

| Pattern | When |
|---|---|
| `describe.skipIf(!tenantReady)` | DB integration without QA tenant |
| `describe.skip` | Retired API — must have waiver (GAP-QA-017) |
| Never skip to hide failures | Use `FLAKY_TEST_POLICY.md` quarantine instead |

---

## npm script tiers

| Script | Scope | When to run |
|---|---|---|
| `test:pr-fast` | QA + critical engines | Every PR (CI) |
| `test:qa` | Full `test/qa/**` | Before merge to RC |
| `test:invariants` | Invariants + regression + arch + golden | Invariant changes |
| `test:integration` | Selected domain integration files | Module work |
| `test:nightly` | Full `vitest run` | Nightly / pre-release |
| `test:rc` | `test:pr-fast` + `test:qa` | Release candidate |

---

## Related documents

- `CURRENT_TEST_ARCHITECTURE.md`
- `TEST_COVERAGE_POLICY.md`
- `FLAKY_TEST_POLICY.md`

---

## Document status

| Field | Value |
|---|---|
| Version | 1.0 |
| Last updated | July 2026 |
| Owner | AD (test/qa conventions) |
