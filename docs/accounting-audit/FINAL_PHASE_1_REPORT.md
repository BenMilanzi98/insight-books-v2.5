# Final Phase 1 Report — Complete Accounting Forensic Audit

Date: 2026-07-20. Database audited: local PostgreSQL 18.4 QA copy (2 tenants, small volume).
Production was never connected. Record counts captured before/after every audit run by the CLI
(`scripts/accounting-forensic-audit.mjs`) confirm **zero accounting rows changed**.

Evidence classes used below: **[Confirmed]** = reproduced on data or verified line-by-line in
code; **[Strong]** = code-verified mechanism, data instance not present locally; **[Probable]**
= consistent with evidence, needs production data; **[Hypothesis]** = requires finance-team
confirmation.

## Answers to the twenty mandated questions

**1. Actual architecture?** [Confirmed] Next.js 15/16 App Router + Prisma 6 + PostgreSQL.
Dual journal ledgers (`Transaction`+lines modern; `JournalEntry`+lines legacy, some rows
header-amount-only with zero lines). Three stored-balance caches (`Account.balance`,
`AccountBalance`, `TenantSettings.ownerContributedCapital`). Period control date-inferred (no
FK), reversals as opposite journals. Full detail: `CURRENT_ARCHITECTURE.md`.

**2. How many posting paths?** [Confirmed] ~30 business events route through `postGlEntry`;
**11 distinct engine-bypass locations** write journals or move balances outside it; 4 paths
write both ledgers; 3 paths move balances with **no journal at all** (POS cash deposits,
legacy capital transfer, bill-cancel AB restore). Inventory: `ACCOUNTING_POSTING_MATRIX.md`.

**3. Which modules create journal entries?** [Confirmed] Sales/POS, invoicing (+payments,
credit/debit notes, refunds), expenses, purchases (bills, goods receipts, supplier payments),
payroll (two competing paths), inventory write-offs, assets (acquisition only), liabilities,
taxes, capital contributions, opening balances, manual journals, reversals.

**4. Which modules update balances directly?** [Confirmed] `accountBalanceService`
(unserialized float read-modify-write on `Account.balance`), `journalService` (legacy ledger
posts), `posCashDayService` and `lib/core.js` (`AccountBalance` with no journal),
`supplierBillCancelPayments`, capital settings counter, plus operator scripts.

**5. Which reports bypass the GL?** [Confirmed] AR/AP aging, multi-tenant cash flow,
dashboard fallback basis + dashboard cash-flow (stored balances), financial ratios
(single-tenant, mislabeled `general_ledger`), summary/analytics, reports-generate (hardcoded
equity constants), legacy IS/BS services still reachable. `FINANCIAL_REPORT_LINEAGE.md`.

**6. Unbalanced journals?** [Confirmed] 2 on local data — both legacy **header-amount
`JournalEntry` rows with zero lines** (JRN-009). [Strong] Production will also contain
unbalanced single-line supplier-payment tax journals (code writes them today).

**7. Sources missing journals?** [Confirmed] 4 locally (2 sales, 2 payments — AR-002/AR-003;
plus supplier-side AP-002/AP-003 instances). [Strong] Swallowed GL errors (payments route,
gratuity, liabilities) generate this class in production.

**8. Journals missing valid sources?** [Confirmed] 0 hard orphans locally; source linkage is
convention-only (`sourceType` free text, no FK), so orphaning is structurally possible.

**9. Duplicate postings?** [Confirmed] 1 duplicate manual-journal pair locally. [Strong]
five production duplicate mechanisms: wrong-table invoice idempotency, shared COGS keys,
unstable payment reference keys, payroll dual path, TOCTOU race in
`assertNoDuplicatePostedSource`. `DUPLICATE_POSTING_ANALYSIS.md`.

**10. Duplicated/misconfigured accounts?** [Confirmed] No duplicate codes locally; structural:
duplicate-purpose salary/AR/AP accounts possible (no purpose constraint), hardcoded code
resolvers with auto-create can mint parallel accounts, TB includes group headers.

**11. Why does the Trial Balance fail?** [Confirmed] balanced locally. Ranked production
causes [Strong→Probable]: header-amount journals in rebuilds, unbalanced single-line tax
journals, dual-ledger merge double counting, parent+child inclusion, stored-balance fallbacks
in comparison reports. `TRIAL_BALANCE_FORENSIC_REPORT.md`.

**12. Why does the GL differ from reports?** [Confirmed] Reports that disagree with GL are the
operational/stored-balance readers in Q5; plus `Account.balance` drift (2 accounts locally,
GL-002) from incremental float updates and legacy header journals.

**13. Why MK1,000,000 → MK2,000,000?** [Confirmed mechanism] Header-amount capital
`JournalEntry` (amount on header) is double-counted: once via the line-based ledger rebuild and
once via header-amount fallback logic; independently, `ownerContributedCapital` settings counter
is preferred by the capital summary while contribution lists are GL-derived — adding both
doubles. Full trace with row IDs: `CAPITAL_AND_EQUITY_AUDIT.md` +
`artifacts/accounting-audit/capital-duplication-evidence.json`. [Hypothesis for the exact
production row] needs the production DB to name the specific journal.

**14. Why liabilities without journal entries?** [Confirmed mechanism] (a) direct
`Account.balance`/`AccountBalance` writes with no journal (legacy `updateAccountBalance`, POS
deposits, backfills); (b) header-amount journals invisible to the line-based Journal Entries
screen; (c) CoA display falls back to `legacy_account_balance` when no posted GL exists.
`PAYABLES_AUDIT.md`.

**15. AR/AP reconciled to control accounts?** [Confirmed] AP reconciles locally; AR diverges
by **−15,000** (control account vs open-invoice subledger) — AR-001. Aging reports never read
the control account, so divergence is invisible to users.

**16. Periods enforced?** [Confirmed] Partially. `assertPeriodOpen` blocks closed periods and
requires open coverage, but is fail-open with zero periods or on unexpected errors; manual
journals and several reversal branches check only "closed"; no `accountingPeriodId` FK; period
overlaps and gaps exist in local data (PER-003 class); **no year-end close** exists at all.

**17. Reversals correct?** [Confirmed] Mechanism sound: new opposite journal, original
preserved, double-reversal blocked, reports net to zero. Defects: original `Transaction` stays
`status='posted'` (only `reversedAt` set) so status-based readers see it live; expense/invoice/
sale reversal branches create transactions directly with the weaker period check; `ReversalAudit`
table is dead (`@@ignore`).

**18. Tenant boundaries secure?** [Confirmed] Data clean locally (0 cross-tenant references),
but code has verified holes: `postGlEntry` accepts foreign account IDs (no tenant filter in
`assertAccountsAllowDirectPosting`); supplier financial routes take `tenantId` from the query
string with no auth (IDOR); reversal/capital endpoints lack RBAC; `JournalEntry.tenantId`/
`Account.tenantId` nullable; tenant cascade deletes reach ledgers.
`MULTI_TENANT_AND_SECURITY_AUDIT.md`.

**19. Which data requires repair?** [Confirmed classes] header-amount journals (rebuild as
line-based or exclude, with journaled migration), drifted `Account.balance` rows, AR −15,000
divergence root records, duplicate manual-journal pair, period overlap/gap definitions,
missing-journal sources (backfill via engine). Production run of `npm run audit:forensic`
will enumerate exact rows.

**20. Safest Phase 2 sequence?** [Recommendation] (1) security holes P0-5 → (2) single-ledger
decision + freeze legacy writers P0-1 → (3) consolidate 11 bypass paths P0-6 → (4) DB
constraints: unique posted-source key, balanced-journal trigger/check, NOT NULL tenant, restrict
cascades P0-2/3/4 → (5) decimal migration for Float money fields → (6) journaled data repair →
(7) report lineage cleanup + year-end close feature. `PHASE_2_REMEDIATION_BACKLOG.md`.

## Deliverables index

- Docs: 23 files in `docs/accounting-audit/` (README lists all).
- Artifacts: 30 machine-readable files in `artifacts/accounting-audit/` (gitignored).
- Tooling: read-only audit engine `lib/accountingAudit/` (9 modules), CLI
  `scripts/accounting-forensic-audit.mjs`, 11 npm commands (`npm run audit:forensic*`),
  Vitest suite `test/accountingAudit.test.js` (all passing).
- Findings on local data: **15** (8 critical, 5 high, 2 medium), export in
  `artifacts/accounting-audit/findings-latest.csv`.

## Integrity attestation

Every audit run records before/after counts of `Transaction`, `TransactionLine`,
`JournalEntry`, `JournalEntryLine`, `Account` and fails loudly on any delta. All runs during
Phase 1 reported zero deltas. No migration was applied; no schema was changed; no financial
row was inserted, updated, or deleted by Phase 1 tooling.
