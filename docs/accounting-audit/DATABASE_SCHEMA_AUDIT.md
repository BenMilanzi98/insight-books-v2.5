# Database Schema Forensic Audit

Source: `prisma/schema.prisma` @ commit `5b59a68` (124 models). This document covers the
accounting-relevant subset. Machine-readable inventory: `artifacts/accounting-audit/schema-inventory.json`.

## Entity coverage vs required accounting entities

| Required entity | Exists as | Notes |
|---|---|---|
| Business/Tenant | `Tenant` | ✔ |
| Branch | `Branch` (+ `UserBranch`) | ✔ soft scoping, nullable on financial rows |
| Department / Project / Cost Centre | `Department` (HR only) | ✘ no financial dimension tables — journal lines carry no department/project/cost-centre |
| Chart of Account | `Account` | ✔ but with legacy duplicate columns (`code`/`accountCode`, `name`/`accountName`, `type`/`accountType`) |
| Account Mapping registry | — | ✘ **missing**; mappings resolved in code by account-code constants (`lib/coaPostingCodes.js`, `lib/accountingMappingRules.js`) |
| Journal Entry / Lines | `Transaction`+`TransactionLine` AND `JournalEntry`+`JournalEntryLine` | ⚠ two ledgers (see below) |
| General Ledger | derived | ✔ derived from lines; plus stored `Account.balance` snapshot |
| Account Balance | `Account.balance`, `AccountBalance`, `AccountBalanceHistory`, `EquityAccount.currentBalance` | ⚠ four stored-balance surfaces |
| Financial Year | — | ✘ missing; `AccountingPeriod.periodType='Yearly'` used as a stand-in |
| Accounting Period | `AccountingPeriod` | ✔ open/closed; no `reopened` status value (reopen sets `open` + audit fields) |
| Reversal | flags on `Transaction` (+`ReversalAudit` table, unmapped) | ⚠ `ReversalAudit` model is `@@ignore`d — table exists but Prisma can't read it |
| Customer / Supplier | `Client` / `Supplier` | ✔; `Supplier.currentBalance` stored `Float` |
| Invoice / Payment / Expense / Purchase | ✔ | operational totals stored (`totalPaid`, `remainingBalance`) |
| Inventory / Stock movement | `InventoryTransaction`, batches | ✔ |
| Payroll / Employee | `Payroll`, `Employee` | ✔; payroll monetary fields `Float` |
| Bank Account / Bank Transaction / Reconciliation | `BankAccount` only | ✘ no statement/reconciliation tables (Phase 10 scope) |
| Fixed Asset / Depreciation | `Asset`, `DepreciationSchedule`, `AssetJournalEntry` | ✔ |
| Loan | `Liability` + `LiabilityPayment` | ⚠ `principalAmount`, `currentBalance`, `totalPaid` are `Float`; `glAccountId` nullable |
| Tax | `TaxType`, `ProductTax`, `SaleItemTax` | ✔ |
| Capital / Owner / Shareholder / Dividend | `EquityAccount` (partial) | ✘ no owner register, no dividend tables |
| Audit Log | `AuditLog`, `AdminAuditLog` | ✔ but no financial before/after row-versioning |
| Approval | scattered status/approvedBy fields | ✘ no approval workflow table |
| Attachment | `ExpenseAttachment`, `InvoiceAttachment` | partial |
| Import Batch | `Sale.migrationBatch` etc. | partial |

## Key schema weaknesses (evidence-based)

### W1 — Two journal ledgers with incompatible shapes (Critical)
`Transaction`/`TransactionLine` (decimal, line-based) and `JournalEntry`/`JournalEntryLine`.
`JournalEntry` additionally carries **legacy header amount columns** `debit Float?` / `credit Float?`
and nullable `accountId` — rows exist (verified in data) with amounts on the header and **zero lines**.
Line-based reporting excludes them; stored balances include them. Divergence proven — see
`CAPITAL_AND_EQUITY_AUDIT.md`.

### W2 — Float monetary fields (High)
`JournalEntry.debit/credit`, `AccountBalance.balance`, `AccountBalanceHistory.*`,
`EquityAccount.openingBalance/currentBalance`, `SupplierPayment.totalAmount`,
`Liability.principalAmount/currentBalance/totalPaid`, `Payment.refundedAmount`, `Payroll` amounts,
`Supplier.currentBalance` are `Float` (IEEE-754). Violates exact-decimal rule. Newer tables
correctly use `Decimal(18,2)`.

### W3 — No unique posting key (High)
Duplicate prevention for `Transaction` is **application-level only**
(`assertNoDuplicatePostedSource` counts posted rows for `tenantId+sourceType+sourceId`).
There is **no DB unique constraint** on `(tenantId, sourceType, sourceId, isReversal)` — concurrent
requests can still double-post (TOCTOU). `JournalEntry` has no source uniqueness either.

### W4 — Nullable tenant scope on financial rows (High)
`JournalEntry.tenantId` is **nullable**, and `Account.tenantId` is nullable. Posted financial rows
with NULL tenant would escape every tenant-scoped report. (Local data: none NULL — risk is structural.)

### W5 — Cascade deletes can destroy accounting evidence (High)
`TransactionLine` → `Transaction` is `onDelete: Cascade` (acceptable child cascade), but
`JournalEntry` → `Tenant` is `onDelete: Cascade` and `Account` → `Tenant` cascade: deleting a tenant
hard-deletes its entire ledger. `JournalEntryLine` → `JournalEntry` cascade allows a journal delete
to silently remove lines; there is no DB-level protection against deleting *posted* journals.

### W6 — No journal→period linkage (Medium)
Neither `Transaction` nor `JournalEntry` stores `accountingPeriodId` or `financialYearId`;
period resolution is purely date-range at query time. Renaming/moving period boundaries silently
re-buckets history. No posting-date vs transaction-date period policy is encoded.

### W7 — Reversals can repeat (Medium)
`Transaction.reversedTransactionId` has an index but **no unique constraint**, so multiple active
reversals of one original are storable (REV-002 checks data; DB does not prevent it).

### W8 — Duplicate legacy columns on `Account` (Medium)
`code`/`accountCode`, `name`/`accountName`, `type`/`accountType` coexist; only
`(tenantId, accountCode)` is unique. Code paths reading the legacy columns can disagree with
paths reading the new ones.

### W9 — `AccountBalance` keyed by account *name* (Medium)
`AccountBalance.account` is a free-text account name with `@@unique([tenantId, account])` —
name-based financial keying; renames orphan balances. (Currently 0 rows locally.)

### W10 — `ReversalAudit` unmapped (Low)
Model is `@@ignore` with only `id` — audit trail table exists in DB but is invisible to the app.

### W11 — No row-version/audit history on journals (Medium)
`JRN-008 (journal modified after posting)` is not detectable: no updated-values history for
`Transaction`/`TransactionLine` beyond `updatedAt` timestamps.

## Decimal precision & currency

- Ledger lines: `Decimal(18,2)` ✔
- No `currency`/`exchangeRate` on `Transaction`/`TransactionLine` — journals are implicitly
  single-currency (MWK); `SupplierPayment` has currency+rate but the GL does not carry them.

## Indexing (adequate for audit-scale queries)

`Transaction`: tenantId, date, status, sourceType, sourceId, reference, branch, isReversal, reversedTransactionId — ✔ sufficient for Phase 1 queries.
Recommended Phase 2 additions: composite `(tenantId, sourceType, sourceId, status)` unique partial
index (posted, non-reversal); `(tenantId, date, status)` composite for period reports.
