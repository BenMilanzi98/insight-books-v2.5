# Duplicate Account Register (Phase 3)

Classifier: `lib/coaV2/application/duplicateClassifier.js` · CLI: `npm run coa:duplicates`
· API: `GET /api/coa-v2/duplicates` · Artifact: `artifacts/accounting-coa/duplicate-account-register.csv`

Accounts are **never merged or deleted automatically**. Every candidate carries a proposed
action and enters the consolidation workflow only after human approval.

## 1. Duplicate classes

| Class | Meaning |
|---|---|
| EXACT_DUPLICATE | Same business, same code, same/equivalent name |
| SEMANTIC_DUPLICATE | Same accounting meaning, different code/name (e.g. 5301 vs 5200 salaries) |
| SIMILAR_DISTINCT | Similar names, legitimately different accounts — keep both |
| HISTORICAL_DUPLICATE | Superseded account still holding history |
| IMPORT_DUPLICATE / TEMPLATE_DUPLICATE | Created by imports/template application |
| CONFLICTING_SYSTEM_PURPOSE | Two accounts competing for one purpose (COA-002) |
| REPORT_ONLY_DUPLICATION | Logical merge (`mergedIntoAccountId`) already redirects reporting; needs formal alias |
| …and code-family, name-family, parent-child, salary-family variants |

Activity counts are taken from **both** ledgers (`TransactionLine` + `JournalEntryLine`,
JRN-009) so "unused" claims are provable.

## 2. Current register (run of 2026-07-20, 5 businesses, 540 accounts)

3 candidate rows, all in tenant `cmqh9u3ku…` (Insight Books), all already inactive/archived,
all with **zero** posted activity:

| Code | Name | Class | Proposed action |
|---|---|---|---|
| 5301 | Salaries & Wages | CONFLICTING_SYSTEM_PURPOSE (canonical 5200 exists) | DEPRECATE_UNUSED |
| 5301 | Salaries & Wages | REPORT_ONLY_DUPLICATION (merged into 5200 row) | DEPRECATE_UNUSED, formalize alias |
| 5600 | Meals & Entertainment | REPORT_ONLY_DUPLICATION (merged) | DEPRECATE_UNUSED, formalize alias |

No candidate requires Phase 6 historical repair (`historicalRepairRequired=false` on all rows).

## 3. Consolidation workflow (§19, implemented in `lifecycleService.js`)

1. **Plan** (`POST /api/coa-v2/consolidation-plans`) — captures full impact analysis
   (usage of duplicate + canonical, classification mismatch warnings) on a
   `CoaV2ConsolidationPlan` row; status `PENDING_APPROVAL`.
2. **Approve** — requires `coa.approveConsolidation` and a **different user** than the
   creator (`ApprovalRequiredError` otherwise).
3. **Execute** — deprecates the duplicate with the canonical as replacement, creates a
   `CoaV2AccountAlias` for the old code, records the Phase 6 repair recommendation when
   history exists. **Historical journal lines are never rewritten.**

Every step writes `coa.consolidation.*` audit records.
