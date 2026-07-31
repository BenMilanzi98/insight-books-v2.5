# Final Phase 14 Report — Loan Readiness Centre

## 1. Executive summary

Phase 14 delivers an advisory Loan Readiness Centre: configuration, loan requests, assessment cycles/versions, amortization, DSCR/ICR, liquidity/leverage, CFADS-based debt capacity, stress scenarios, covenants, transparent scoring (weights = 100%), risk findings, Excel/JSON lender packs, APIs, and UI. Proposed facilities **never** post to the General Ledger or create Liability rows. Scores are explicitly **not** lender decisions.

## 2–3. Evidence & prior defects

See `PHASE_1_TO_13_EVIDENCE_INDEX.md` and `CURRENT_LOAN_READINESS_ARCHITECTURE.md`. Pre-Phase 14: no DSCR/capacity/score module; liability UI amortization was client-side only.

## 4–5. Architecture & database

- Module: `lib/loanReadiness/`  
- Entities: `LrdV2Configuration`, `LrdV2AssessmentCycle`, `LrdV2AssessmentVersion`, `LrdV2LoanRequest`, `LrdV2AssessmentSnapshot`, `LrdV2AICommentary`  
- Migration: `20260721190000_loan_readiness_v2` (**applied**)

## 6–55. Capabilities

| Area | Implementation |
|---|---|
| Config / cycles / versions | `application/configService.js`, `assessmentService.js` |
| Amortization | `domain/amortizationEngine.js` |
| DSCR / ICR / liquidity / leverage | `domain/dscrEngine.js` |
| Debt capacity + stress | `domain/debtCapacityEngine.js` |
| Scoring + prohibited attrs | `domain/scoringEngine.js` |
| Orchestration | `domain/assessmentEngine.js` |
| Export | `application/exportService.js` |
| UI | `/loan-readiness` (no “V2” label) |
| APIs | `/api/loan-readiness/*` |

## Confirmations

| Rule | Status |
|---|---|
| Actuals from canonical services / register | Yes (liabilities + optional forecast payload) |
| Proposed loans never create JE/Liability | Yes |
| Schedules reconcile | Yes (tests) |
| Capacity not revenue-only | Yes (LRD-017) |
| Score weights transparent / sum 100% | Yes |
| Protected attributes excluded | Yes |
| Score ≠ lender approval | Disclaimer everywhere |
| AI cannot bypass review | AI flag not default-enabled |
| Approved assessments immutable | Service + snapshot |
| Cross-business rejected | Tenant predicates |

## Completed in follow-up (deferred close-out)

| Item | Implementation |
|---|---|
| Hard SoD | `domain/separationOfDuties.js` + `review` / `approve` gates; preparer cannot review or approve |
| Proposed debt in 3-statement | `domain/proposedFacilityProjection.js` via PlanV2 `projectThreeStatements`; proceeds ≠ revenue |
| Board pack | `exportBoardPack` + `?pack=board` on export API |
| Document checklist | `domain/documentChecklist.js` |
| AI commentary API | `POST /api/loan-readiness/ai` (flag `aiLoanReadinessCommentaryEnabled` not default-on) |

## Remaining / deferred

- Full branded PDF board pack theming  
- Persistent covenant monitoring jobs  
- Production document storage + malware scan

## Deploy / verify / rollback

```bash
npx prisma migrate deploy
npx vitest run test/loanReadiness.engine.test.js
```

Disable: set `loanReadinessV2Enabled` enabled=false. Do not delete approved snapshots.
