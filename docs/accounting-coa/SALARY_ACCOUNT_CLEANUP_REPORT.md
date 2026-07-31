# Salary Account Cleanup Report (Phase 3 §20)

Enforcement: `lib/coaV2/application/salaryAccountEnforcement.js`
· CLI: `npm run coa:salary-audit` · Artifact: `artifacts/accounting-coa/salary-account-audit.csv`

## 1. Policy

- **5200 Salaries & Wages** is the single canonical salary expense account
  (`lib/salaryExpenseAccountCodes.js`, preserved verbatim).
- Future payroll postings resolve **only** through the `SALARIES_AND_WAGES` purpose mapping
  (registry) — explicit `MissingAccountMappingError` when unconfigured; never name search,
  never auto-create.
- Conflicting duplicates are identified by **code membership** in the known legacy family
  (5301, 5201, 5202, 5203, 5230). Name patterns (`salar|wage|payroll|…`) only FLAG
  candidates for human review — they never drive posting resolution or automated exclusion.
- Payroll **liabilities** (PAYE, pension, deductions) stay in liability accounts and resolve
  through their own purposes — a liability can never satisfy `SALARIES_AND_WAGES`
  (category constraint EXPENSE, enforced in `validateAccountForPurpose`; covered by tests).
- The expense selector (`getValidExpensePostingAccounts`) excludes conflicting salary codes,
  so 5301-family accounts cannot be picked for new expenses even while still ACTIVE.

## 2. Audit results (2026-07-20, 5 businesses — 11 salary-like accounts)

| Pattern | Count | Disposition |
|---|---|---|
| 5200 canonical (one per business) | 5 | KEEP_CANONICAL — one has 1 transaction line (QA-Accounting), rest clean |
| 1216 Salary Advance Receivable (ASSET) | 5 | REVIEW_NOT_EXPENSE — correctly an asset; name-flagged only, no action |
| 5301 Salaries & Wages (Insight Books) | 1 | DEPRECATE_UNUSED — archived, zero activity, already logically merged into 5200; formalize as alias via consolidation plan |

No salary account requires Phase 6 historical repair (`historicalRepairRequired=false` on
all rows). The only cleanup action is executing a consolidation plan for the archived 5301
duplicate, which is listed in the duplicate register with a proposed canonical of the
business's 5200 account.

## 3. Guards that keep this fixed

- COA-017 integrity check: salary purpose mapped outside 5200 → finding.
- COA-002: duplicate `systemPurpose` per business → finding.
- Blueprint/template rows assign `SALARIES_AND_WAGES` only to 5200.
- `validateAccountCodeChange` refuses to renumber the 5200 anchor.
