# Final Gap Register — Reversals + Tax Management

**Date:** 2026-07-25  
**Gate:** Audit pack complete — proceed Wave 1–2 foundation per approved plan.

## Critical
| ID | Gap | Disposition |
|----|-----|-------------|
| G-C01 | No TransactionReversal aggregate / approvals / unique constraints | REIMPLEMENT Wave 2 |
| G-C02 | Document reverse RBAC ≠ journal.reverse; auto-grant in reverseSourceJournals | EXTEND Wave 2 |
| G-C03 | No tax periods/returns/credits/withholding suite | REIMPLEMENT Waves 3–4 |
| G-C04 | Tax hub nav points to /tax-types; duplicate /tax + /tax-management | MIGRATE Wave 1 |

## High
| ID | Gap | Disposition |
|----|-----|-------------|
| G-H01 | Original doc reverse linkage / details lookup direction | FIX Wave 2 |
| G-H02 | List API id mapping + in-memory pagination | MIGRATE Wave 2 |
| G-H03 | tax.settle unused; export endpoint missing | EXTEND Wave 1/5 |
| G-H04 | VAT purpose vs 2041/2045 dual track | MIGRATE Wave 3 |
| G-H05 | Impact preview not same path as execute | EXTEND Wave 2 |
| G-H06 | Stale invoice reversal integration test | REIMPLEMENT Wave 6 |

## Medium
| ID | Gap | Disposition |
|----|-----|-------------|
| G-M01 | tax-rules mock page | REIMPLEMENT or retire later |
| G-M02 | PermissionGuard on reversals page uses reports.view | ALIGN Wave 2 |
| G-M03 | TaxType no versioning | EXTEND Wave 3 |
| G-M04 | No TaxTransaction subledger | REIMPLEMENT Wave 3 |

## Classification board
| Piece | Verdict |
|-------|---------|
| journalReversalService | KEEP |
| reverseSourceJournals | KEEP / EXTEND |
| transactionReversalService | EXTEND / MIGRATE into lib/reversals |
| Reversals list API | MIGRATE |
| TaxType + CRUD APIs | KEEP / EXTEND |
| tax-types / tax-accounts pages | MIGRATE into hub |
| tax + tax-management duplicates | MIGRATE to one hub |
| Periods/returns/credits/WHT | REIMPLEMENT |
| tax.* permissions | KEEP + alias taxManagement.* |

## Counts
Critical 4 · High 6 · Medium 4

## Readiness
Waves 0–6 foundation delivered. See [FINAL_READINESS_DECISION.md](./FINAL_READINESS_DECISION.md).  
**Action required locally:** stop Node/Next processes holding Prisma engine, run `npx prisma generate`, restart app, confirm Wave 2–4 migrations applied.  
Full compliance certification / exhaustive edge-case suite is not claimed.
