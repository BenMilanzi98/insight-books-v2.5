# Phase 3 Tasks — Chart of Accounts Reconstruction, Account Mapping and Control Framework

Status values: Pending / In progress / Completed / Deferred (with phase).
All migrations are additive; no historical journals are modified; no accounts deleted.

| # | Workstream | Status | Depends on | Files | Migration | Tests | Risk | Evidence / notes |
|---|---|---|---|---|---|---|---|---|
| A | Evidence review | Completed | — | `docs/accounting-coa/PHASE_1_AND_2_EVIDENCE_INDEX.md` | — | — | Low | 17 findings indexed from actual Phase 1/2 outputs |
| B | Current implementation analysis | Completed | — | `docs/accounting-coa/CURRENT_CHART_OF_ACCOUNTS_ARCHITECTURE.md` | — | — | Low | Full repo survey: models, 6 creation paths, resolver map, APIs, UI |
| C | Target account domain model | Completed | A, B | `lib/coaV2/domain/accountModel.js`, `ACCOUNT_DOMAIN_MODEL.md` | Account V2 columns (additive, nullable) | domain tests | Medium — must not break legacy reads | V2 fields coexist with legacy columns; legacy untouched |
| D | Account-category framework | Completed | C | `lib/coaV2/domain/categories.js` | — | category/subtype validation tests | Low | Reuses Phase 2 `AccountCategory`; adds subtypes + category↔subtype rules |
| E | Type & behaviour framework | Completed | C, D | `lib/coaV2/domain/behaviours.js` | behaviour column | behaviour tests | Low | Reuses Phase 2 `AccountBehaviour`; behaviour×purpose validation |
| F | Hierarchy reconstruction | Completed | C | `lib/coaV2/domain/hierarchy.js` | depth/path columns | hierarchy tests (cycles, depth, derived totals) | Medium | Cycle detection, ancestors/descendants, derived totals, no parent+child double count |
| G | Account-code governance | Completed | C | `lib/coaV2/domain/codeGovernance.js` | — | code validation tests | Low | Ranges, normalization, immutability-after-history policy, 5000 header + 5200 salaries preserved |
| H | System account registry | Completed | D, E | `lib/coaV2/domain/systemPurposes.js`, `SYSTEM_ACCOUNT_REGISTRY.md` | systemPurpose column + mapping table | purpose validation tests | Medium | 53-purpose catalogue with category/behaviour/normal-balance constraints (8 elevated) |
| I | Control account framework | Completed | H | same as H + mapping validators | controlAccountPurpose column | control tests | Medium | AR/AP control purposes, manual-posting restriction flags |
| J | Account Mapping Service | Completed | H, I | `lib/coaV2/application/accountMappingRegistry.js`, swap in `serviceContracts.js` | `CoaV2AccountMapping` table | mapping tests | High — replaces Phase 2 backing | Registry-first with legacy-code fallback behind flag; typed errors; no auto-create |
| K | Financial-statement mapping | Completed | D | `lib/coaV2/domain/financialStatementMapping.js` | fsSection/fsSubsection columns | FS mapping tests | Medium | Explicit statement/section/sign; defaults derived from category, overridable |
| L | Cash Flow mapping | Completed | K | `lib/coaV2/domain/cashFlowClassification.js` | cashFlowClassification column | classification tests | Low | OPERATING/INVESTING/FINANCING/CCE/NON_CASH/UNCLASSIFIED for Phase 7 |
| M | Tax mapping | Completed | H, J | purposes VAT_INPUT/OUTPUT/PAYABLE, PAYE, WHT, corporate tax in registry + validators | via mapping table | mapping tests | Low | Existing `TaxType.accountId` untouched; registry adds governed purposes |
| N | Duplicate account classification | Completed | B | `lib/coaV2/application/duplicateClassifier.js`, `DUPLICATE_ACCOUNT_REGISTER.md`, `artifacts/accounting-coa/duplicate-account-register.csv` | — | classifier tests | Medium | 13 duplicate classes; activity counts from both ledgers; rerunnable CLI |
| O | Legacy account alias framework | Completed | C | `CoaV2AccountAlias` model, `lib/coaV2/application/aliasResolver.js` | alias table | alias tests | Low | Aliases resolve future lookups; never rewrite history |
| P | Default account templates | Completed | D–H | `lib/coaV2/templates/coaTemplates.js`, `DEFAULT_COA_TEMPLATES.md` | `CoaV2Template`/`CoaV2TemplateAccount` tables | template tests | Medium | Versioned, immutable after publication; blueprint v1 registered as GENERAL_SME; compare/apply-additions flow |
| Q | Existing-business migration | Completed | N, P | `lib/coaV2/application/businessReadiness.js`, `scripts/coa-v2-classify.mjs`, `EXISTING_BUSINESS_READINESS.md`, `artifacts/accounting-coa/business-coa-readiness.csv` | Stage-2 backfill (nullable columns only) | migration tests | High | Stage-gated: backfill only where proven; readiness statuses per business |
| R | Chart of Accounts APIs | Completed | C–Q | `app/api/coa-v2/**` (12 routes) | — | API tests | Medium | Governance surface: lifecycle, usage, mappings assign/retire, validate, duplicates, consolidation plans, templates compare/apply, expense selector, CSV export |
| S | Chart of Accounts UI | Completed | R | `app/chart-of-accounts/governance/page.js` | — | — | Low | Governance console (tree, filters, detail, validation, mappings); existing CoA page untouched |
| T | Permissions & audit trail | Completed | R | `lib/accountingV2/permissions.js` (extended), audit actions | — | permission tests | Low | 17 coa.* keys; every governance write audited via `recordAccountingAudit` |
| U | Integrity monitoring | Completed | C–M | `lib/accountingAudit/coaIntegrityAudit.js` registered as `coa-v2` | — | integrity tests | Low | COA-001..COA-025 checks in the Phase 1 audit engine |
| V | Automated testing | Completed | all | `test/coaV2.*.test.js` | — | — | Low | domain, hierarchy, mapping, expense, salary, system-account, API-schema, boundary suites |
| W | Deployment & rollback | Completed | Q | `COA_MIGRATION_STRATEGY.md`, `MIGRATION_VALIDATION.md` | migration validation | rerun/rollback validation | Medium | Deploy via `prisma migrate deploy`; documented rollback SQL |
| X | Phase 4 readiness | Completed | all | `PHASE_4_READINESS.md` | — | — | Low | Mapping completeness gate for posting-engine activation |
| Y | Final validation | Completed | all | `FINAL_PHASE_3_REPORT.md` | — | full suite + lint + build | Low | Acceptance criteria checklist |

## Out of scope (deferred)

- Historical journal-line reclassification → Phase 6 (recommendations recorded per consolidation plan).
- Posting-engine integration of the resolver → Phase 4.
- Report/statement replacement → Phase 5/7.
- `Account.tenantId` NOT NULL + duplicate-column drop → separate approved migration after
  production verification (blockers 1–2 in PHASE_3_READINESS).
