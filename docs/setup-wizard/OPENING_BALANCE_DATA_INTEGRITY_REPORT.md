# Opening Balance Data Integrity Report

**Date:** 2026-07-22  
**Purpose:** Assess risks to financial integrity from current opening-balance and setup behaviour.  
**Method:** Code-path forensics (not a live production DB dump). Live tenant classification requires a follow-up SQL inventory script against each environment.

---

## 1. Integrity principles (target)

1. Enter once → post once → balance → trace → reconcile subledgers.  
2. All opening money effects via Accounting V2 Posting Engine.  
3. No direct GL / TB mutation; no duplicate opening journals.  
4. AR/AP/Stock/Assets/Loans/Equity control accounts match subledgers.  
5. No revenue/expense pollution from historical openings.  
6. Business-scoped; period-open; idempotent; immutable posted journals.

---

## 2. Current posting authority

| Path | Authority | Integrity |
|---|---|---|
| `AcctV2OpeningBalanceBatch` + Posting Engine | Canonical | Good design; underused by wizard |
| `postOpeningBalance` (legacy) | **Removed** (throws) | Call sites that still depend on it produce **missing GL** |
| `POST /api/accounts/opening-balances` | **410** | Clients get failure; may leave domain rows without journals |
| Module-local creates (clients, stock qty, assets) without V2 batch | Operational data only | **Subledger without matching opening journal** risk |

---

## 3. Risk catalogue

### R1 — Phantom progress (CRITICAL)

Wizard marks steps complete from heuristics / user skip while GL never received a balanced opening batch.

**Symptom:** Dashboard “setup done”; TB/BS incomplete or empty openings.  
**Mitigation needed:** Completion only after successful V2 post + reconcile.

### R2 — Dead legacy call sites (CRITICAL)

Financial-setup / stock / payment flows that still call `postOpeningBalance` fail closed for GL while UI may show success for domain save.

**Symptom:** Inventory or payment balances in modules; Opening Balance Equity / control accounts unchanged.  
**Mitigation needed:** Replace all call sites with V2 batch lines; integration tests.

### R3 — Dual-stack confusion (HIGH)

Operators may use V2 OB API while others use wizard/financial-setup. No single Setup Run ties them.

**Symptom:** Partial batches; unclear which openings are authoritative.  
**Mitigation needed:** One active Setup Run per business version; link all domain openings to it.

### R4 — Opening stock qty without GL (CRITICAL)

Basic stock import updates FIFO/WAC/qty; clearing journal via engine not fully wired for setup cutover.

**Symptom:** Stock valuation ≠ Inventory Asset; P&L may later absorb wrong COGS base.  
**Mitigation needed:** Opening Stock event → Inventory Dr / OB Equity Cr (or approved balancer) once.

### R5 — AR/AP without opening subledger journals (CRITICAL)

Clients/suppliers can exist; outstanding opening invoices/bills not systematically created as opening events.

**Symptom:** Aging empty or filled with “new” docs that hit revenue/expense; control mismatch.  
**Mitigation needed:** Opening receivable/payable docs + V2 posting rules that **do not** hit current revenue/expense.

### R6 — Capital / RE / CYE duplication (HIGH)

Capital account UI + equity-management + manual OB lines can overlap without setup uniqueness constraints.

**Symptom:** Equity overstated; equation fails or is “balanced” via suspense.  
**Mitigation needed:** Single equity schedule per setup version; ban unexplained CYE opening.

### R7 — Existing business re-entry (CRITICAL)

No classifier for `EXISTING_WITH_FINANCIAL_ACTIVITY` before restarting openings.

**Symptom:** Second opening batch on live journals/invoices/stock.  
**Mitigation needed:** Activity scan + conversion mode + approval + dry-run.

### R8 — Period / date ambiguity (HIGH)

Starting date tip exists; cutover vs OB date pair and period resolution not enforced in wizard.

**Symptom:** Post into wrong/closed period; ambiguous timezone dates.  
**Mitigation needed:** Explicit OB date + cutover; resolve FY/period server-side.

### R9 — Idempotency gaps (HIGH)

V2 batch has identities; wizard final “finish” does not reserve `BUSINESS_SETUP:<businessId>:<version>`.

**Symptom:** Timeout retry creates second effect when wiring is naive.  
**Mitigation needed:** DB-unique setup posting identity; return existing result on retry.

### R10 — Cross-business ID trust (MEDIUM–HIGH)

App generally scopes by tenant; setup imports must reject foreign customer/supplier/item/account IDs explicitly in every setup API.

**Mitigation needed:** Server-side Business Context on all setup endpoints (planned).

---

## 4. Expected data classes in environments (to inventory)

Run against each DB before migration (script TBD in migration strategy):

| Class | Detection sketch |
|---|---|
| NEW_EMPTY_BUSINESS | No journals, invoices, bills, stock moves, payroll |
| NEW_PARTIALLY_CONFIGURED | CoA/payments exist; no posted openings |
| EXISTING_WITHOUT_FINANCIAL_ACTIVITY | Master data only |
| EXISTING_WITH_FINANCIAL_ACTIVITY | Any posted V2 journal or operational docs |
| EXISTING_SETUP_COMPLETED | Heuristic: V2 OB batch POSTED + wizard complete (weak today) |
| LEGACY_OB_ORPHANS | Domain opening fields with no V2 batch link |
| DUPLICATE_OPENING_SUSPECTS | Multiple OB batches / stock openings same as-of |

**Do not fabricate Setup Run history** for orphans — mark `RECONSTRUCTED_LEGACY` only when Finance reviews links.

---

## 5. Accounting pollution checks (must stay green after implementation)

| Check | Required result |
|---|---|
| Opening AR | Dr AR / Cr OB Equity (or approved) — **not** Revenue |
| Opening AP | Dr OB Equity / Cr AP — **not** current Expense |
| Opening Stock | Dr Inventory / Cr OB Equity — **not** Expense/COGS |
| Opening Loan | Dr OB Equity / Cr Loan — **not** Revenue |
| Opening Capital | Cr Capital — **not** Revenue |
| Accum. Dep | Cr Accum Dep / Dr OB Equity — **not** current Dep Expense |
| Final | Σ Debits = Σ Credits; A = L + E; controls = subledgers |

---

## 6. Current integrity verdict

| Question | Answer |
|---|---|
| Are all openings posted once via engine? | **No** |
| Does wizard completion prove TB balance? | **No** |
| Do subledgers reconcile to controls at setup end? | **No** |
| Is legacy OB safely gone from all call sites? | **No** (API dead; callers remain) |
| Is V2 OB safe when used correctly via API? | **Yes (by design/tests)** |
| Safe to declare Setup Wizard complete? | **No** |
| Safe to run uncontrolled OB re-entry on live tenants? | **No** |

---

## 7. Immediate integrity actions (before broad coding)

1. Inventory call sites of `postOpeningBalance` and `/api/accounts/opening-balances`.  
2. Document which financial-setup UI paths still expect legacy.  
3. Add SQL classifier for tenant activity (migration strategy).  
4. Freeze “wizard complete” as non-authoritative until V2 post + reconcile exists.  
5. Design approval: Setup Run + wire wizard to V2 batches (next section in TASKS).
