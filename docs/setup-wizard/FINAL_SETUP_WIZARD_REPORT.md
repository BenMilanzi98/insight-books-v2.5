# Final Setup Wizard Report

**Date:** 2026-07-22  
**Forks:** A3 · B1 · C2 · D2  
**Status:** **Foundation + lifecycle shipped — not zero-defect / not full master-prompt completion**

---

## 1. Executive summary

InsightBooks now has a resumable Business Setup Run at `/setup` that can validate a consolidated opening Trial Balance, enforce D2 conversion gates, apply C2 SoD policy, and post **one Opening Journal** through `AcctV2OpeningBalanceBatch` + the Posting Engine (B1).

This is a working onboarding framework core. It is **not** a claim that every master-prompt acceptance criterion (imports pack, document vault, full subledger document creation, E2E suite, granular permission seeds, completion pack PDF) is finished.

---

## 2. What was implemented

| Area | Result |
|---|---|
| Setup Run aggregate | `BusinessSetupRun` / `BusinessSetupStep` |
| State machine | Run + step transitions |
| D2 classifier | Blocks unsafe starts without conversion approval |
| A3 UI | Full-page `/setup` + dashboard banner launcher |
| Profile / ownership / calendar | Draft save + profile sync hooks |
| CoA / mappings | Ensure CoA + resolve system mappings on save |
| Domain opening lines | Line editor for payment/AR/AP/stock/assets/loans/tax/equity/manual |
| TB preview | Compile + debit/credit totals + drill table |
| A = L + E | Equation panel; blocks submit when unbalanced |
| Reconciliations | Control checks for AR/AP/inventory + domain self-checks |
| C2 SoD | Solo combined roles; self-approval denied when segregated |
| B1 posting | One OB batch → one journal; idempotent retry |
| Reopen | Request + approve creates new setup version; preserves prior journal ids |
| Tests | 26 unit tests in `test/setupWizard` |

---

## 3. APIs

| Method | Path |
|---|---|
| GET/POST | `/api/setup/runs` |
| GET/PATCH | `/api/setup/runs/[id]` |
| GET | `/api/setup/runs/[id]/validate` |
| POST | `/api/setup/runs/[id]/submit\|approve\|post\|reopen-request\|reopen-approve` |

---

## 4. Remaining gaps (honest)

1. Opening AR/AP/stock still capture **GL lines** in setup payloads — not full invoice/bill/stock-movement domain document creation on post.  
2. Excel import templates for all domains not packaged.  
3. Secure document vault upload not implemented (evidence references only).  
4. Notifications / full audit catalogue incomplete.  
5. Granular `setup.*` permissions alias to `settings.view`.  
6. Completion Pack PDF/Excel not generated.  
7. Full browser E2E + concurrency suite not added.  
8. Master-prompt docs tree (60+ files) not fully written — core docs exist.

---

## 5. Confirmations (within implemented scope)

| Rule | Status |
|---|---|
| Post via Central Posting Engine (V2 OB batch) | Yes (post path) |
| One Opening Journal per setup version (B1) | Yes |
| No direct GL balance mutation in setup services | Yes |
| TB must balance before submit/post | Yes |
| A = L + E checked | Yes |
| Idempotent post retry | Yes (returns existing) |
| Posted journals not edited; reopen new version | Yes |
| D2 conversion gate | Yes |
| C2 self-approval policy | Yes |
| Cross-business account rejected in compiler | Yes (tenant check) |

---

## 6. Verification

```bash
npx prisma migrate deploy
npx vitest run test/setupWizard
```

Manual: `/setup` → enter balanced lines → validate → submit → approve → post.

---

## 7. Readiness conclusion

**Ready for:** controlled internal use / continued hardening on empty or conversion-approved businesses.  

**Not ready for:** declaring the master prompt fully complete or production cutover with zero remaining defects.
