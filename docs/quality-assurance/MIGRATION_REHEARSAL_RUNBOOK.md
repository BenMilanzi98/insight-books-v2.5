# Migration Rehearsal Runbook

Operational steps to rehearse tenant migration on **staging** before production cutover. Complements `MIGRATION_TEST_STRATEGY.md`.

**Status:** Manual today; CI automation **NOT_STARTED** (GAP-QA-025, workstream AZ).

---

## Prerequisites

| Item | Verification |
|---|---|
| Staging `DATABASE_URL` | Clone or sanitized copy of production subset |
| Tenant slug | e.g. `QA-Accounting` or pilot tenant code |
| Node 20 + deps | `npm ci && npx prisma generate` |
| Backup | Full PG dump before rehearsal |
| Team | Engineering + finance observer |

---

## Rehearsal checklist

### Phase 0 — Baseline capture (T+0)

```bash
# Record baseline audit + scenarios
npm test -- test/accountingAudit.test.js
npm run verify:accounting-scenario -- --tenant=<PILOT_TENANT>
```

Record outputs:
- `artifacts/quality-assurance/rehearsal-<date>-baseline.json`
- Audit finding counts by rule (JRN, GL, AR, CAP, TB, TEN)

**Pass criteria:** Document all Critical/High findings — do not proceed if new P6-XTEN-001.

---

### Phase 1 — CoA normalization (T+1h)

1. Run salary consolidation plan (if SAL-DUP open):
   ```bash
   node scripts/consolidate-salary-accounts.js --tenant=<id> --dry-run
   ```
2. Review `docs/accounting-coa/DUPLICATE_ACCOUNT_REGISTER.md` for 5200/5301.
3. Execute approved plan (non-dry-run) on staging only.

**Verify:**
```bash
npm test -- test/legacyExpenseAccountRemaps.test.js test/coaMigration.test.js
```

**Pass:** Payroll mapping resolves to **5200**; no duplicate active 5301 salary postables.

---

### Phase 2 — Ledger rebuild (T+2h)

1. Trigger V2 ledger rebuild API or script for tenant date range.
2. Compare stored vs derived balances (GL-002).

**Verify:**
```bash
npm test -- test/accountingV2.ledger.test.js test/glReconciliation.test.js
npm run verify:accounting-scenario -- --tenant=<PILOT_TENANT>
```

**Pass:** MT-002 trial balance; GL-002 findings unchanged or reduced.

---

### Phase 3 — Report validation (T+3h)

1. Generate TB, IS, BS, CF from V2 reports module for Jun 2026 (or tenant FY).
2. Spot-check CAP-005 / EQT-035 — owner capital once.

**Verify:**
```bash
npm test -- test/accountingV2.reports.test.js
```

**Pass:** REG-CAP-MK1M-001 equivalent manual check; TB-003 headers not double-counted.

---

### Phase 4 — Posting smoke (T+4h)

1. Post test invoice through V2 adapter (staging).
2. Confirm idempotency — duplicate event rejected.

**Verify:**
```bash
npm test -- test/accountingV2.postingEngine.test.js
```

---

### Phase 5 — Rollback drill (T+5h)

1. Restore PG dump from Phase 0.
2. Confirm tenant matches baseline scenario output.

**Pass:** Restored DB === baseline JSON within documented tolerances (AR EPS 0.01 from scenario script).

---

## Automated rehearsal (planned)

```bash
MIGRATION_REHEARSAL=1 DATABASE_URL=$STAGING_URL npm test -- test/qa/migration-rehearsal.test.js
```

**NOT_STARTED** — workstream AZ.

---

## Failure handling

| Failure | Action |
|---|---|
| MT-003 AR mismatch | Stop; investigate AR-001 before proceed |
| CAP-005 MK2M persists | Stop; finance review equity journals |
| JRN-009 increases | Stop; repair batch before migration |
| TEN-001 detected | **Stop — security incident path** |

---

## Sign-off record

| Role | Name | Date | Result |
|---|---|---|---|
| Engineering | | | |
| Finance | | | |
| QA | | | |

Store in `artifacts/quality-assurance/rehearsal-<date>-signoff.md`.

---

## Frequency

| Trigger | Requirement |
|---|---|
| Major schema migration | Full rehearsal |
| CoA script change | Phase 1 + 3 |
| Report engine release | Phase 3 |
| Production cutover | Full rehearsal within 7 days |

---

## Related

- `RELEASE_CERTIFICATION_PROCESS.md`
- `docs/security-governance/ROLLBACK_STRATEGY.md`
- `scripts/verify-accounting-scenario.cjs`
