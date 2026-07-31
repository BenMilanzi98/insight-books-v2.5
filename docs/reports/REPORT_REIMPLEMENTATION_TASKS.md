# Report Reimplementation Task Plan

**Date:** 2026-07-22  
**Approved forks:** **R1-B** (V2 JE-only) · **R2-A** (JE money + ops context) · **R3-C** (`/reports-v2` only) · **R4-A** (posting-only / capital once)  
**Design spec:** `docs/superpowers/specs/2026-07-22-reports-reimplementation-design.md`  
**Plan:** `docs/superpowers/plans/2026-07-22-reports-v2-only-cutover.md`  
**Track status:** **CLOSED** 2026-07-22 — see `FINAL_REPORT_REIMPLEMENTATION_REPORT.md`.

---

## Phase 0 — Forensic (DONE)

- [x] Inspect routes, APIs, services, exports, V2 stack
- [x] `CURRENT_REPORT_IMPLEMENTATION.md`
- [x] `REPORT_DEFECT_REGISTER.md` (~50 defects)
- [x] `REPORT_DATA_LINEAGE_AUDIT.md`
- [x] `REPORT_SOURCE_OF_TRUTH_MATRIX.md`
- [x] This task plan

---

## Design forks (APPROVED 2026-07-22)

| Fork | Choice | Meaning |
|---|---|---|
| R1 | **R1-B** | Financial totals from Accounting V2 JE only |
| R2 | **R2-A** | Ops reports: JE money + operational context |
| R3 | **R3-C** | Force `/reports-v2` only; legacy `/reports` redirects |
| R4 | **R4-A** | Posting-account rollup; MK1,000,000 capital once |

---

## Phase 1 — Registry & GL query

- [x] Reuse V2 definitions / contracts / validation  
- [x] Parent-child / exceptional-header rules (R4-A)  
- [x] Lineage + JE drill-down on V2 hub  

## Phase 2 — Financial statements

- [x] P&L, Profit Analysis, Balance Sheet, Cash Flow on V2  
- [x] Legacy cash-flow product path retired (410)

## Phase 3 — Ops-context reports

- [x] Tax (existing V2 `TAXES`), Sales, Expenses, Stock, Loss, Daily POS — JE-first

## Phase 4 — UX / export / security

- [x] `/reports-v2` selector + `?type=`  
- [x] V2 export envelope for V2 types  
- [x] Tests + FINAL report  

---

## Backlog (not blocking CLOSED)

- Delete residual legacy `/api/reports/*` generators  
- Richer POS receipt/shift context join  
- Dead invoice IS/BS generator removal  
- Broader a11y / completion pack  

