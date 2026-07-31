# Implementation Plan — Accounting & Expenses

**Date:** 2026-07-25  
**Strategy:** Expense module is **EXTEND**, not full REIMPLEMENT. Fix CoA governance and payment GL before UX expansions.

## Ordered phases

### (1) Retire anti-blueprint templates — P0

**Goal:** Single SoT = `lib/chartOfAccountsBlueprint.js` + CoA V2 apply.  
**Work:** Deprecate/no-op `lib/expenseCategoriesTemplate.js` ensure; stop colliding `lib/accountTemplates.js` expense codes; retarget `expenseCategoryNormalization.js`.  
**Exit:** No path creates `5100` as Operating Expenses. Gaps: GAP-001–003, GAP-015.

### (2) Expand blueprint expense leaves — P1

**Goal:** Cover overtime, fuel, licences, FX loss, inventory adj `5290`, corporate tax, project costs.  
**Work:** Edit blueprint; update CoA V2 classification; sync [EXPENSE_ACCOUNT_HIERARCHY.md](./EXPENSE_ACCOUNT_HIERARCHY.md).  
**Exit:** Purposes that need leaves have blueprint rows. Gap: GAP-004.

### (3) Fix purpose codes — P0

**Goal:** Correct `legacyCode` / resolution policy.  
**Work:** `VAT_INPUT` → `1240`; `PRIMARY_BANK` not bare `1130`; `COST_OF_SALES` not bare `5100`; remap existing tenants.  
**Exit:** Purpose audit clean. Gaps: GAP-005–007.

### (4) Fix expense payment adapter — P0

**Goal:** Eliminate double-debit opex.  
**Work:** Dedicated payment posting; AP/cash settlement only; registry keys; regression tests.  
**Exit:** TC-EXP-02/03/04 green. Gap: GAP-008 (+ GAP-013).

### (5) Expense state machine + posting preview — P1

**Goal:** Enumerated statuses; `previewPosting` before commit.  
**Work:** Schema/API enums; UI preview panel. Gaps: GAP-009–010.

### (6) Multi-line expenses — P2

**Goal:** `ExpenseLine` + multi-debit adapter. Gap: GAP-011.

### (7) xlsx export/import dry-run — P2

**Goal:** Backup-grade export; dry-run import. Gap: GAP-012.

### (8) Tests — continuous gate

**Goal:** Lock invariants in CI (`accounting-verify`). Gap: GAP-013; also GAP-014/016 hardening tests.

## Non-goals (this programme)

- Rewriting POS/invoice adapters that already use `executePosting`  
- Replacing V2 engine  
- Full historical ledger rebuild unless merge policy demands it  

## Dependency graph

```
(1) templates ──► (2) leaves ──► (3) purposes
                      │
                      ▼
                 (4) payment fix ──► (8) tests
                      │
                      ▼
              (5) SM + preview ──► (6) multi-line ──► (7) xlsx
```

## Delivery artefacts

Task checklist: [IMPLEMENTATION_TASKS.md](./IMPLEMENTATION_TASKS.md)  
Gaps: [FINAL_GAP_REGISTER.md](./FINAL_GAP_REGISTER.md)  
Design stubs: CoA template, hierarchy, mappings, engine, idempotency, expense DM/SM/selection/rules/preview/traceability.
