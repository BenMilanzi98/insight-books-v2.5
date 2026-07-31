# Accounting & Expenses Reimplementation Pack

**Audit date:** 2026-07-25  
**Scope:** Chart of Accounts (CoA), default templates, expense account coverage, V2 posting engine, expense module (CRUD / payment / import-export), duplicate-posting and multi-tenant integrity risks.  
**Verdict:** Expense operational posting is **EXTEND** (not full REIMPLEMENT). CoA template governance and expense-payment GL path require **REFACTOR / FIX** before further product work.

## Classification tags used in this pack

| Tag | Meaning |
|-----|---------|
| `COMPLETE_AND_VERIFIED` | Behaviour matches V2 intent and was confirmed in code |
| `REUSE` | Keep as-is; depend on it |
| `EXTEND` | Keep core; add missing capabilities |
| `REFACTOR` | Same responsibility; change implementation shape |
| `REIMPLEMENT` | Replace with new design (rare in this pack) |
| `DUPLICATED` | Two or more sources of truth for the same concept |
| `INCORRECT_POSTING` | Wrong debit/credit or wrong account resolution |
| `MISSING_ACCOUNT` | Blueprint / purpose lacks a required leaf |
| `LEGACY_READ_ONLY` | Fail-closed or diagnostic-only; must not write financial SoT |
| `DUPLICATE_POSTING_RISK` | Can post the same economic event twice |
| `LEGACY_POSTING_REMOVED` | Legacy writer throws; V2 adapter required |

## Source-of-truth summary

| Domain | SoT | Anti-patterns / legacy |
|--------|-----|------------------------|
| CoA structure | `Account` + `CoaV2AccountMapping`; blueprint `lib/chartOfAccountsBlueprint.js` | `lib/expenseCategoriesTemplate.js`, `lib/accountTemplates.js`, wrong codes in `lib/expenseCategoryNormalization.js` |
| Posting | `executePosting` (`lib/accountingV2/engine/postingEngine.js`) via adapters | `postGlEntry` → `LEGACY_POSTING_REMOVED` |
| Idempotency | `AcctV2EventRegistry` unique keys (`lib/accountingV2/infrastructure/eventRegistryRepository.js`) | Expense partial-payment can still double-debit expense |
| Balances | V2 journal lines / ledger | `Account.balance` mutations (recalculate, capital transfer, CoA merge) — not financial SoT |
| Expenses | `Expense` model + `postExpenseAccounting` | No `ExpenseLine`; free-form status; no posting preview UI |

## Document index

### Audit & registers

| File | Purpose |
|------|---------|
| [CURRENT_IMPLEMENTATION_AUDIT.md](./CURRENT_IMPLEMENTATION_AUDIT.md) | End-to-end current-state classification |
| [CHART_OF_ACCOUNTS_AUDIT.md](./CHART_OF_ACCOUNTS_AUDIT.md) | CoA SoT, dual columns, merge divergence |
| [DEFAULT_ACCOUNT_TEMPLATE_AUDIT.md](./DEFAULT_ACCOUNT_TEMPLATE_AUDIT.md) | Anti-blueprint templates |
| [EXPENSE_ACCOUNT_COVERAGE_AUDIT.md](./EXPENSE_ACCOUNT_COVERAGE_AUDIT.md) | Missing expense leaves |
| [ACCOUNTING_POSTING_AUDIT.md](./ACCOUNTING_POSTING_AUDIT.md) | Engine, adapters, fail-closed legacy |
| [ACCOUNTING_MODULE_POSTING_MATRIX.md](./ACCOUNTING_MODULE_POSTING_MATRIX.md) | Module → adapter matrix |
| [EXPENSE_MODULE_AUDIT.md](./EXPENSE_MODULE_AUDIT.md) | Expense product surface |
| [EXPENSE_IMPORT_EXPORT_AUDIT.md](./EXPENSE_IMPORT_EXPORT_AUDIT.md) | CSV-only export; no xlsx dry-run |
| [DUPLICATE_POSTING_RISK_REGISTER.md](./DUPLICATE_POSTING_RISK_REGISTER.md) | Double-post paths |
| [DATA_INTEGRITY_RISK_REGISTER.md](./DATA_INTEGRITY_RISK_REGISTER.md) | Balance / merge / code integrity |
| [MULTI_TENANT_RISK_REGISTER.md](./MULTI_TENANT_RISK_REGISTER.md) | Tenant isolation risks |
| [TEST_COVERAGE_AUDIT.md](./TEST_COVERAGE_AUDIT.md) | Gaps in automated proof |
| [FINAL_GAP_REGISTER.md](./FINAL_GAP_REGISTER.md) | Numbered GAPS P0–P2, status OPEN |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Ordered delivery plan |
| [IMPLEMENTATION_TASKS.md](./IMPLEMENTATION_TASKS.md) | Executable task checklist |

### Design stubs (concrete targets)

| File | Purpose |
|------|---------|
| [CHART_OF_ACCOUNTS_TEMPLATE.md](./CHART_OF_ACCOUNTS_TEMPLATE.md) | Canonical blueprint contract |
| [EXPENSE_ACCOUNT_HIERARCHY.md](./EXPENSE_ACCOUNT_HIERARCHY.md) | Target 5xxx hierarchy + new leaves |
| [SYSTEM_ACCOUNT_MAPPINGS.md](./SYSTEM_ACCOUNT_MAPPINGS.md) | Purpose → code corrections |
| [CANONICAL_POSTING_ENGINE.md](./CANONICAL_POSTING_ENGINE.md) | `executePosting`-only contract |
| [POSTING_IDEMPOTENCY.md](./POSTING_IDEMPOTENCY.md) | Event registry keys for expenses |
| [EXPENSE_DATA_MODEL.md](./EXPENSE_DATA_MODEL.md) | Header + future `ExpenseLine` |
| [EXPENSE_STATE_MACHINE.md](./EXPENSE_STATE_MACHINE.md) | Enumerated statuses + transitions |
| [EXPENSE_ACCOUNT_SELECTION.md](./EXPENSE_ACCOUNT_SELECTION.md) | CoA picker rules |
| [EXPENSE_POSTING_RULES.md](./EXPENSE_POSTING_RULES.md) | Recognition vs payment postings |
| [EXPENSE_POSTING_PREVIEW.md](./EXPENSE_POSTING_PREVIEW.md) | Preview before commit |
| [EXPENSE_TRACEABILITY.md](./EXPENSE_TRACEABILITY.md) | Source → journal drill-down |

## Recommended reading order

1. This README  
2. `FINAL_GAP_REGISTER.md`  
3. `IMPLEMENTATION_PLAN.md` + `IMPLEMENTATION_TASKS.md`  
4. Domain audits as needed (CoA → Posting → Expenses)
