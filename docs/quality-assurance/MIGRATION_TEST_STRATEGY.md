# Migration Test Strategy

Test approach for accounting architecture cutover, CoA consolidation, and tenant data migration. Grounded in `docs/accounting-architecture/DATA_TRANSITION_STRATEGY.md` and Phase 1 risks R-01–R-09.

---

## Migration phases under test

| Phase | Scope | Test type |
|---|---|---|
| M1 — Readiness | Audit clean on tenant | `npm run verify:accounting-scenario`, audit engine |
| M2 — CoA normalize | SAL-DUP → 5200, header 5000 | `coaMigration.test.js`, `legacyExpenseAccountRemaps.test.js` |
| M3 — Ledger unify | Transaction → JournalEntry V2 | Stub + DB rehearsal |
| M4 — Balance rebuild | GL-002 stored vs derived | `glReconciliation.test.js`, ledger rebuild API |
| M5 — Report cutover | TB-003, CAP-005 | `accountingV2.reports.test.js` |
| M6 — Security hardening | SEC-1, TEN-002 NOT NULL | Phase 15 + `test/qa/*` |

---

## Test pyramid for migration

```
         [ M6 rehearsal — full tenant clone ]
       [ M3–M5 integration — staging DB ]
     [ M2 unit — CoA scripts + domain ]
   [ M1 audit rules — accountingAudit.test.js ]
```

---

## Pre-migration invariants (must pass)

| ID | Check | Automated |
|---|---|---|
| MT-001 | Audit JRN-001..009 on tenant | audit API / script |
| MT-002 | TB-001 trial balance balances | scenario `trial-balance` |
| MT-003 | AR-001 within tolerance | scenario `ar-subledger` |
| MT-004 | No P6-XTEN-001 open critical | repair anomaly scan |
| MT-005 | SAL-DUP plan approved | manual + `DUPLICATE_ACCOUNT_REGISTER.csv` |

---

## Migration script coverage

| Script / module | Unit test | Rehearsal |
|---|---|---|
| `lib/chartOfAccountsCanonicalMigration.js` | `coaMigration.test.js` | Staging |
| `scripts/consolidate-salary-accounts.js` | indirect via remaps | Staging |
| `scripts/remap-accounting-mappings.js` | `legacyExpenseAccountRemaps.test.js` | Staging |
| Ledger rebuild service | `accountingV2.ledger.test.js` | Staging |
| Opening balance posting | `openingBalanceAndDisplay.test.js` | Staging |

---

## Dual-ledger regression (R-01)

**Risk:** Header-amount `JournalEntry` rows invisible to line-based V2 reports.

| Test | File | Status |
|---|---|---|
| Detect JRN-009 | `accountingAudit.test.js` | ✅ |
| Exclude header from line totals | `accountingV2.ledger.test.js` | ✅ |
| MK1M once on BS | `accountingV2.reports.test.js` | FAILING |
| Post-migration zero JRN-009 | — | NOT_STARTED rehearsal assertion |

---

## Idempotency & rollback (R-03)

| Test | Evidence |
|---|---|
| Re-run migration script safe | Required in rehearsal runbook |
| Event registry duplicate block | `accountingV2.postingEngine.test.js` |
| Repair snapshot before batch | `accountingV2.repair.test.js` |

---

## Tenant isolation (TEN-001, SEC-1)

| Test | When |
|---|---|
| Cross-tenant line detection | Pre + post migration audit |
| V2 posting rejects foreign accounts | Continuous — `postingEngine.test.js` |
| NOT NULL tenantId | Post GAP-SEC-026 migration |

---

## Data validation samples

Per tenant migration:

1. **Trial balance** — debits = credits (MT-002)
2. **5200 payroll total** — unchanged after SAL-DUP remap
3. **Owner capital** — single MK1M (EQT-035 / CAP-005)
4. **Open AR** — matches 1200 (MT-003)
5. **Period coverage** — no PER-001 on posted set

---

## Environments

| Env | Purpose | DATABASE |
|---|---|---|
| Local | Unit + stub | Optional local PG |
| CI | Vitest only | Secret optional |
| Staging | Rehearsal | Clone of prod subset |
| Production | Cutover | Live — no test writes |

---

## Exit criteria

- [ ] `MIGRATION_REHEARSAL_RUNBOOK.md` executed twice successfully on staging
- [ ] All MT-001–MT-005 green post-rehearsal
- [ ] `accountingV2.reports.test.js` green (M5)
- [ ] Finance sign-off on SAL-DUP / CAP-005 spot checks
- [ ] Rollback drill documented in `docs/security-governance/ROLLBACK_STRATEGY.md`

---

## Related

- `MIGRATION_REHEARSAL_RUNBOOK.md`
- `DEFECT_REGRESSION_CATALOGUE.md`
- `docs/accounting-architecture/DATA_TRANSITION_STRATEGY.md`
