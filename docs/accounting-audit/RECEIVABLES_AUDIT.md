# Receivables Audit

Run: `npm run audit:forensic -- --module ar-ap,sources` • Artifacts:
`artifacts/accounting-audit/ar-ap-reconciliation.csv`, `findings-latest.csv`.

## Control-account reconciliation (tenant QA-Accounting)

| Measure | Amount |
|---|---|
| AR control account 1200 (journal-derived) | **70,000.00** |
| Open-invoice operational subledger | **85,000.00** |
| Difference | **−15,000.00** (AR-001, critical) |

### Decomposition of the 15,000 difference (fully traced)

1. **Invoice `QA-S18-INV` (35,000, status `sent`)** — the GL posted only a *partial* entry
   `QA-S18-GL-PARTIAL` of 20,000 to AR. Operational subledger carries 35,000
   (via `total − totalPaid` fallback because `remainingBalance` is 0 — itself inconsistent).
   Gap: 15,000.
2. Invoice `QA-S04-INV` (50,000, `sent`): GL has the full 50,000 (`QA-S04-GL`), but the
   operational row also has `remainingBalance = 0` while `totalPaid = 0` — the stored
   invoice balance fields are internally inconsistent (two medium AR-001 findings). The
   reconciliation only works because the fallback `total − totalPaid` was used.

## Source-linkage results

| Finding | Evidence |
|---|---|
| Completed sale `QA-S02-SALE` has **no GL transaction traceable by source id** | GL entry `QA-S02-GL` exists but with caller-key `sourceId='QA-pos-mobile-money'` — traceability broken, not the posting itself. Confirms the weak `sourceId` convention |
| Invoice `QA-S18-INV` under-posted (see above) | AR-002 |
| Payments (30,000 / 50,000 on `QA-S05-INV`) have no `Transaction.sourceId = payment.id` | GL entries `QA-S05-GL-PAY1/2` exist with keys `QA-invoice-payments-pay1/2` — again traceable only by convention, not by key (AR-003, confidence: possible) |

## Module mechanics (verified in code)

- AR aging (`lib/arAgingService.js`) and dashboards compute from **operational Invoice rows**
  (status/remaining balance), not from the AR control account — subledger and control account
  can diverge silently (exactly what the reconciliation shows).
- Invoice payment updates `Invoice.totalPaid`/`remainingBalance` operationally and posts GL
  separately; there is **no invariant** keeping `remainingBalance = total − totalPaid` (violations
  observed) nor any AR-control reconciliation job.
- Cancelled invoices are excluded operationally and reversed in GL via reversal transactions
  (verified: `QA-S06-INV` cancelled + `QA-S06-GL-REV` posted — nets to zero, correct).
- Draft invoices excluded from both — correct.

## Verdict

Receivables **cannot currently be proven reconciled**: the control account and the subledger are
maintained by two independent mechanisms with no reconciliation control, and the invoice
balance fields themselves are internally inconsistent. Reconciliation logic is now automated in
the audit engine for continuous measurement.
