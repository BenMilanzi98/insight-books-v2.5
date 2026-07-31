# Audit Rule Catalogue

Rule codes implemented by the Phase 1 audit engine (`lib/accountingAudit/`), plus rules
documented for manual/Phase 2 verification. Severity is the default; individual findings may
be raised or lowered based on evidence.

## Journal integrity (JRN)

| Code | Rule | Default severity | Implemented in |
|---|---|---|---|
| JRN-001 | Journal debits ≠ credits | Critical | `journalIntegrityAudit.js` |
| JRN-002 | Journal has no lines / a single line | Critical | `journalIntegrityAudit.js` |
| JRN-003 | Line has both debit and credit | High | `journalIntegrityAudit.js` |
| JRN-004 | Line has neither debit nor credit, or negative amount | Medium/High | `journalIntegrityAudit.js` |
| JRN-005 | Posted journal has no source module reference | Medium | `journalIntegrityAudit.js` |
| JRN-006 | Same source has multiple active posted journals | Critical | `journalIntegrityAudit.js` |
| JRN-007 | Posted journal missing posting date | Medium | `journalIntegrityAudit.js` |
| JRN-008 | Journal modified after posting | High | *Not detectable from data (no row-version history); documented as schema gap* |
| JRN-009 | Legacy header-amount JournalEntry (amounts on header, zero lines) | High | `journalIntegrityAudit.js` |

## Chart of Accounts (COA)

| Code | Rule | Default severity | Implemented in |
|---|---|---|---|
| COA-001 | Duplicate account code within tenant | High | `chartOfAccountsAudit.js` |
| COA-002 | Multiple active accounts serving one purpose (salaries, AR, AP, capital, retained earnings, CYP, VAT) | High | `chartOfAccountsAudit.js` |
| COA-003 | Direct postings on parent account with active children | High | `chartOfAccountsAudit.js` |
| COA-004 | Missing/invalid code, name, type, or normal balance | Medium | `chartOfAccountsAudit.js` |
| COA-005 | Cross-business account reference | Critical | `ledgerReconciliationAudit.js` (TEN-001) |
| COA-006 | Inactive account carries posted lines | Medium | `chartOfAccountsAudit.js` |
| COA-007 | Parent-child cycle or orphan parent reference | High/Medium | `chartOfAccountsAudit.js` |
| COA-008 | Missing required system account mapping | High | *Phase 2 (requires mapping registry definition)* |

## General Ledger (GL)

| Code | Rule | Default severity | Implemented in |
|---|---|---|---|
| GL-001 | GL module output differs from journal reconstruction | Critical | Manual comparison (see `GENERAL_LEDGER_AUDIT.md`) |
| GL-002 | Stored `Account.balance` differs from journal-derived balance | Critical (High when explained by JRN-009 rows) | `ledgerReconciliationAudit.js` |
| GL-003 | Opening balance inconsistency | High | *Phase 2 (needs period snapshots)* |
| GL-004 | Running balance inconsistency | High | *Phase 2* |

## Receivables / Payables (AR / AP)

| Code | Rule | Default severity | Implemented in |
|---|---|---|---|
| AR-001 | Customer subledger ≠ AR control account (incl. internally inconsistent invoice fields) | Critical/Medium | `arApReconciliationAudit.js` |
| AR-002 | Posted sale/invoice has no journal | Critical | `sourceLinkageAudit.js` |
| AR-003 | Customer payment has no traceable journal | Critical (confidence: possible) | `sourceLinkageAudit.js` |
| AR-004 | Customer payment posted more than once | Critical | via JRN-006 source grouping |
| AP-001 | Supplier subledger ≠ AP control account | Critical | `arApReconciliationAudit.js` |
| AP-002 | Posted supplier bill/expense has no journal | Critical | `sourceLinkageAudit.js` |
| AP-003 | Supplier payment has no journal | Critical | `sourceLinkageAudit.js` |
| AP-004 | Liability balance without journal support | Critical | `arApReconciliationAudit.js` |

## Accounting periods (PER)

| Code | Rule | Default severity | Implemented in |
|---|---|---|---|
| PER-001 | Posted transaction not covered by any accounting period | High | `periodsReversalsAudit.js` |
| PER-002 | Transaction created after its period was closed | Critical | `periodsReversalsAudit.js` |
| PER-003 | Overlapping periods or monthly gaps | High/Medium | `periodsReversalsAudit.js` |
| PER-004 | Period status change without audit info (e.g. reopen without reason) | Medium | `periodsReversalsAudit.js` |

## Capital & equity (CAP)

| Code | Rule | Default severity | Implemented in |
|---|---|---|---|
| CAP-001 | Capital source posted more than once to an equity account | Critical | `capitalEquityAudit.js` |
| CAP-002 | Parent and child equity accounts both carry balances (report double-count hazard) | High | `capitalEquityAudit.js` |
| CAP-003 | Owner drawing posted as business expense | High | *Phase 2 (needs mapping registry)* |
| CAP-004 | Capital contribution posted as revenue | High | *Phase 2* |
| CAP-005 | Equity balance stored independently of GL (legacy header journals, `EquityAccount.currentBalance`) | High/Medium | `capitalEquityAudit.js` |

## Trial Balance (TB)

| Code | Rule | Default severity | Implemented in |
|---|---|---|---|
| TB-001 | Independent trial balance does not balance | Critical | `trialBalanceAudit.js` |
| TB-002 | TB module output differs from journal reconstruction | Critical | Manual comparison (see `TRIAL_BALANCE_FORENSIC_REPORT.md`) |
| TB-003 | Account has direct postings AND posted children (double-count hazard) | High | `trialBalanceAudit.js` |
| TB-004 | Reversed journals incorrectly included/excluded | High | *reversal netting verified in `REVERSALS_AUDIT.md`* |

## Reversals (REV)

| Code | Rule | Default severity | Implemented in |
|---|---|---|---|
| REV-001 | Reversal has no (or missing) original journal | High | `periodsReversalsAudit.js` |
| REV-002 | Original journal reversed more than once (active) | Critical | `periodsReversalsAudit.js` |
| REV-003 | Reversal totals/accounts differ from original | High/Medium | `periodsReversalsAudit.js` |
| REV-004 | Reversal posted into unauthorized closed period | Critical | *covered by PER-002 for reversal transactions* |

## Tenant isolation (TEN)

| Code | Rule | Default severity | Implemented in |
|---|---|---|---|
| TEN-001 | Cross-business financial reference (line → other tenant's account) | Critical | `ledgerReconciliationAudit.js`, `periodsReversalsAudit.js` |
| TEN-002 | Financial record with NULL/absent business scope | Critical | `journalIntegrityAudit.js` (NULL `JournalEntry.tenantId`) |
| TEN-003 | Unauthorized financial access | Critical | Code review (see `MULTI_TENANT_AND_SECURITY_AUDIT.md`) |
