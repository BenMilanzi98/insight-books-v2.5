# Test Isolation

Rules ensuring tests do not leak state, tenants, or side effects.

---

## Unit / QA layer (default)

| Rule | Implementation |
|---|---|
| No shared DB | `test/qa/**` uses factories only |
| Reset ID sequences | `beforeEach(() => resetIdSequence(0))` |
| Reset webhook nonces | `_resetWebhookNonces()` in security invariant tests |
| No `.only` in repo | Enforced by `static.boundaries.test.js` |
| Distinct stub tenants | `biz_TEST_001` vs `biz_TEST_002` for cross-tenant cases |

---

## Prisma stub isolation

**File:** `test/helpers/acctV2PrismaStub.js`

- Each test file creates fresh stub via `makeAcctV2PrismaStub(seed)`.
- `$transaction` rollback via snapshot/restore — failed posts do not persist.
- `simulateRaceOnce` is opt-in per test, not global.

---

## DB integration isolation

| Pattern | Behaviour |
|---|---|
| `describe.skipIf(!tenantReady)` | Skips entire suite if no QA tenant |
| Scenario script | Read-only — no writes |
| `tenantExistsForIntegration` | Disconnects Prisma in `finally` |

**Deferred:** Per-test transaction rollback on real DB (Phase 17). Today integration tests are read-mostly or skip.

---

## Environment variable isolation

Security session tests save/restore `process.env.SESSION_SIGNING_SECRET` around cases (`security.invariants.test.js`).

---

## Anti-patterns

| Problem | Mitigation |
|---|---|
| Tests order-dependent | Reset factories in `beforeEach` |
| Cross-file tenant pollution | Do not use real tenant names in unit tests |
| Focused tests committed | Architecture scan fails CI |

---

## Related documents

- `MULTI_TENANT_ISOLATION_MATRIX.md`
- `TEST_FACTORIES_AND_BUILDERS.md`
- `FLAKY_TEST_POLICY.md`

---

## Document status

| Field | Value |
|---|---|
| Version | 1.0 |
| Last updated | July 2026 |
| Owner | AD (test/qa conventions) |
