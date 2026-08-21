# Simplified Loan Readiness Centre — Design Spec

**Date:** 2026-08-21  
**Status:** Approved  
**Approach:** Simplify in place (keep LRD engine + Prisma; remove config/SoD ceremony)

---

## 1. Goals

1. Enter loan terms → **Run assessment** in one click.
2. Auto-ensure ACTIVE configuration (no draft/approve).
3. Fix BigInt JSON serialization (no 500 on create).
4. No SoD / review / approve ceremony on the happy path.
5. Scores remain **advisory only**; proposed facilities never post to GL.

Non-goals: rewriting the scoring/DSCR engines; lender package redesign; AI commentary UX.

---

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Happy path | One-click run |
| Config | Auto-ensure ACTIVE |
| Approvals / SoD | Not required in UI |
| Architecture | Simplify existing LRD module |
| Opening balances | Keep demo defaults for pilot (unchanged from current page) |

---

## 3. UX

Single page `/loan-readiness`:

### Request
- Amount, term (months), rate (bps), grace, purpose

### Run
- Primary button: **Run assessment**

### Results + History
- Score, band, integrity, capacity summary, advisory disclaimer
- List of recent assessment cycles/versions
- No Save draft / Approve config / Mark reviewed / Approve assessment

---

## 4. API / service behaviour

### Config
- `ensureLoanReadinessConfiguration` creates or activates config (`status: ACTIVE` or treat APPROVED/ACTIVE as ready).
- GET auto-ensures; PUT optional (no approve action required for UI).

### Run assessment
`POST /api/loan-readiness/assessments` with `action: 'run'` (or default):

1. ensure config  
2. create loan request  
3. create cycle  
4. create version  
5. calculate  
6. return `{ version, loanRequest, cycle, result }` with BigInts as strings  

### Serialization
All API responses that include `LrdV2LoanRequest` (or any BigInt) must serialize minors as strings (e.g. `String(bigint)` or a `serializeLoanReadiness` helper).

### Legacy
Keep calculate / review / approve endpoints for compatibility; UI does not call them.

---

## 5. Acceptance

1. Run assessment once → score/capacity shown; no config ceremony.  
2. No 422 from missing config approve; no 500 from BigInt.  
3. History lists the new run.  
4. Disclaimer visible: not a lender decision / does not post to GL.

---

## 6. Files to touch

- `lib/loanReadiness/application/configService.js` — ensure ACTIVE  
- `lib/loanReadiness/application/assessmentService.js` — `runAssessment`; serialize BigInt  
- `app/api/loan-readiness/assessments/route.js` — `action: 'run'`  
- `app/api/loan-readiness/config/route.js` — auto-ensure on GET  
- `app/loan-readiness/page.js` — simplified UI  
- Tests: serialization + run path smoke if practical
