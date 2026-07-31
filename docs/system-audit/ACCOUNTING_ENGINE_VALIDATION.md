# Accounting Engine Validation

| Field | Value |
|---|---|
| V2 engine | `lib/accountingV2/` — posting coordinator, adapters, ledger, periods |
| Legacy engine | `lib/accountingEngine/` — **partially retired** |
| Test coverage | **PARTIAL** — domain strong; full integration + legacy migration incomplete |
| E2E production validation | **NOT CLAIMED**

---

## Posting paths (verified in code)

### V2 coordinator (target state)

| Path | Entry | Posts to |
|---|---|---|
| API posting engine | `POST /api/accounting-v2/posting-engine` | `AcctV2Journal` + lines |
| Journal workflow | `/api/accounting-v2/journals/*` | AcctV2 tables |
| Opening balances | `/api/accounting-v2/opening-balances/*` | AcctV2 + period checks |
| Bank recon adjustments | `lib/bankReconciliation/application/adjustmentService.js` | Via posting adapter |
| Equity transactions | `lib/equityManagement/application/transactionService.js` | Via V2 posting |
| Close batches | `lib/accountingClose/application/closingBatchService.js` | Closing journals |

Coordinator writes **outbox rows** in same transaction (`lib/accountingV2/infrastructure/outbox.js`). Dispatcher consumer **not implemented** (SYS-DEF-004).

### Legacy paths (still present)

| Path | Status |
|---|---|
| `lib/accountingEngine/postManualJournalEntry.js` | Legacy manual post |
| `lib/paymentGlPosting.js`, invoice/expense routes | Mixed — migration to V2 adapters ongoing |
| `postGlEntry` callers | Tests expect removal — **FAILING** (DEF-LEG-POST) |

Feature flags (`lib/accountingV2/infrastructure/featureFlags.js`) gate rollout; fresh-books mode uses **NEW_ENGINE** only.

---

## Adapters & source types

V2 adapters under `lib/accountingV2/adapters/` wrap operational events (credit notes, payments, etc.). Template registry: `lib/accountingV2/templates/`.

Posting matrix (legacy vs V2): `docs/accounting-audit/ACCOUNTING_POSTING_MATRIX.md`.

---

## Test coverage map

| Area | Test file(s) | Status |
|---|---|---|
| Posting engine core | `accountingV2.postingEngine.test.js` | ✅ domain |
| Posting integration | `accountingV2.posting.test.js`, `accountingEngine.integration.test.js` | PARTIAL |
| Idempotency | REG-POST-IDEM-001 in posting engine tests | ✅ |
| Tenant isolation | REG-TEN-POST-001 | ✅ V2 |
| Ledger | `accountingV2.ledger.test.js` | ✅ |
| Periods | `accountingV2.periods.test.js` | ✅ |
| Reports | `accountingV2.reports.test.js` | **FAILING** subsets |
| Repair | `accountingV2.repair.test.js` | ✅ domain |
| Boundaries | `accountingV2.boundaries.test.js`, `qa/architecture/static.boundaries.test.js` | ✅ |
| Invariants | `qa/invariants/accounting.invariants.test.js` | ✅ incl. PLAN/LRD no-GL |
| Regressions | `qa/regression/defect.regressions.test.js` | ✅ permanent guards |
| Legacy audit | `accountingAudit.test.js` | ✅ read-only rules |

**Gap:** Full `npm test` green — **UNKNOWN** (SYS-DEF-001).

---

## Advisory modules (must not post)

| Module | Guard |
|---|---|
| Financial planning | REG-PLAN-NOGL — `projectThreeStatements` has no journals |
| Loan readiness | REG-LRD-NOGL — `assertNeverPostsToGl` on assessment |

Validated in regression + invariant tests — **not** a substitute for API penetration testing.

---

## Validation checklist (pending prod)

- [ ] Shadow mode off on all production tenants before cutover
- [ ] All operational modules route through V2 coordinator (posting matrix green)
- [ ] Forensic audit: zero unbalanced posted journals
- [ ] Outbox backlog monitored (or dispatcher shipped)
- [ ] TB-003 header presentation verified on production tenant sample

---

## References

- `docs/accounting-posting-engine/` — Phase 2–3 engine docs
- `docs/accounting-architecture/RISK_REGISTER.md` — P2-01 legacy bypass
- `ACCOUNTING_ENGINE_VALIDATION.md` (this file) + `KNOWN_DEFECT_REGRESSION_REPORT.md`
