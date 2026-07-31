# Final Phase 3 Report — Chart of Accounts Reconstruction, Account Mapping and Control Framework

Date: 2026-07-20 · Scope: CoA governance framework (no posting-engine changes, no
historical journal modification, no account deletion).

## 1. What was reconstructed and why

Phase 1/2 evidence (17 indexed findings) showed the chart of accounts was resolved by
hardcoded codes and name matching, silently created accounts, carried duplicate salary and
expense accounts, double-counted parent/child balances, and had no lifecycle, purpose, or
permission governance. Phase 3 replaces that with a controlled dictionary:

| Area | Delivered |
|---|---|
| Domain model | `lib/coaV2/domain/` — categories/subtypes with derived normal balances, behaviours (HEADER/POSTING/CONTROL/SYSTEM/CONTRA), lifecycle state machine, hierarchy validation with derived-descendant totals, code governance (anchors 5000/5100/5200 preserved), 53 system purposes, FS/CF mappings, currency policy, field-change policy |
| Database | Additive migration `20260720130000_coa_v2_governance`: 27 nullable `Account` columns + `CoaV2AccountMapping`, `CoaV2AccountAlias`, `CoaV2Template`, `CoaV2TemplateAccount`, `CoaV2ConsolidationPlan` |
| Mapping | Business-scoped registry implementing the Phase 2 `AccountMappingService` contract; context-specific resolution; typed errors; legacy blueprint fallback behind `coaV2CanonicalMappings`; contract swap live in `serviceContracts.js` |
| Lifecycle & consolidation | Deprecate/archive/restore with usage-driven guards; two-person consolidation plans that deprecate + alias duplicates for future postings only |
| Selectors | Governed expense-account query (headers, COGS, salary duplicates, cross-business excluded); salary resolution locked to the SALARIES_AND_WAGES purpose |
| Templates | 3 versioned immutable templates (GENERAL_SME, RETAIL, SERVICE) with compare/apply-additions flow |
| Backfill | 540/540 accounts across 5 businesses classified; 0 manual-review rows |
| Integrity | COA-001..COA-025 checks registered as the `coa-v2` forensic-audit module; current run: **0 findings** |
| APIs | 12 routes under `/api/coa-v2/*` (lifecycle, usage, mappings, validate, duplicates, consolidation plans, templates, expense selector, CSV export) with typed-error mapping |
| UI | Governance console at `/chart-of-accounts/governance` (validation, mappings, duplicates, consolidation, templates); classic CoA page untouched |
| Permissions | 17 granular `coa.*` keys added to the central catalogue; elevated purposes require system-account permission |
| Audit trail | 15 `coa.*` audit actions written append-only to `AuditLog` with previous/new values, reason, and correlation ids |
| Tests | 73 new tests (53 domain + 20 service) — all passing |

## 2. Current data state

- 5 businesses, 540 accounts, all V2-classified.
- Duplicate register: 3 rows (archived 5301 salary + 2 report-only merges), zero activity,
  no Phase 6 repair required.
- Salary audit: canonical 5200 present in all businesses; one archived duplicate pending a
  consolidation plan.
- Readiness: 4× READY, 1× REQUIRES_CLEANUP (Insight Books — cleared by executing the
  5301→5200 consolidation plan).

## 3. Verification evidence (details in MIGRATION_VALIDATION.md)

- Migrations: schema up to date (97 applied), additive-only.
- Integrity audit: 0 findings, record counts unchanged.
- Tests: 493 passed; the 8 failures reproduce on a clean tree and predate Phase 3.
- Lint: clean on all new/changed directories. Production build: compiled successfully with
  all new routes.

## 4. Explicitly out of scope (per the Phase 3 mandate)

Full posting-engine implementation (Phase 4) · journal/GL reconstruction (Phase 5) ·
historical journal repair (Phase 6 — currently none required) · balancing entries without
documentation (never) · deletion of accounts with history (never — hard-delete guard
`assertAccountDeletable` enforces this).

## 5. Documentation index

PHASE_1_AND_2_EVIDENCE_INDEX · CURRENT_CHART_OF_ACCOUNTS_ARCHITECTURE · PHASE_3_TASKS ·
ACCOUNT_DOMAIN_MODEL · SYSTEM_ACCOUNT_REGISTRY · DUPLICATE_ACCOUNT_REGISTER ·
SALARY_ACCOUNT_CLEANUP_REPORT · DEFAULT_COA_TEMPLATES · EXISTING_BUSINESS_READINESS ·
COA_MIGRATION_STRATEGY · MIGRATION_VALIDATION · PHASE_4_READINESS · this report.
Artifacts: `artifacts/accounting-coa/*.csv` (duplicate register, readiness, salary audit).
