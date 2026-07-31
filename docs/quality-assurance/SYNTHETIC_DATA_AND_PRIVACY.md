# Synthetic Data & Privacy

Rules for test data in InsightBooks V2 — no real customer PII, no production database access.

---

## Principles

1. **Synthetic only** — fictional business names, amounts, and IDs in unit/QA tests.
2. **No production reads/writes** — tests must not use production `DATABASE_URL`.
3. **Redaction in audit paths** — secrets masked in security engine tests (`redactForAudit`).
4. **QA tenant is operational, not personal** — tenant `QA-Accounting` holds seeded GL for scenario checks only.

---

## Data tiers

| Tier | Location | PII risk | Rules |
|---|---|---|---|
| In-memory stubs | `test/helpers/acctV2PrismaStub.js`, `test/qa/factories/*` | None | Use `biz_TEST_*`, `user_TEST_*` IDs |
| QA tenant (DB) | PostgreSQL `QA-Accounting` | Low — seeded demo data | Read-only scenario script; no export to docs |
| Golden fixtures | `test/qa/golden/*.json` | None | Structural amounts only (MWK) |
| Certification artifacts | `artifacts/quality-assurance/*.json` | None | Commit hash + test tail only |

---

## Forbidden in tests

| Item | Reason |
|---|---|
| Real customer names, emails, phone numbers | Privacy |
| Production API keys / session secrets | Security |
| Copying production DB dumps into repo | Compliance |
| Logging full `.env` in CI | Secret leakage |

Use `TEST_SESSION_SECRET` or inline test secrets only in test files (see `security.invariants.test.js` session signing case).

---

## Related documents

- `TEST_DATA_ARCHITECTURE.md` — layer model L0–L4
- `TEST_DATABASE_ENVIRONMENT.md` — DB setup
- `SECURITY_INVARIANT_CATALOGUE.md` — SEC-INV-021–024 redaction
- `MIGRATION_REHEARSAL_RUNBOOK.md` — disposable DB for cutover drills

---

## Document status

| Field | Value |
|---|---|
| Version | 1.0 |
| Last updated | July 2026 |
| Owner | O (test data architecture) |
