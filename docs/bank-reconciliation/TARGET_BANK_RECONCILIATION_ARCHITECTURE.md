# Target Bank Reconciliation Architecture

## Identity

- **Bank master:** `PaymentAccount` (`Bank` / `Mobile Money`) with `coaAccountId`
- **Config:** `BankRecConfiguration` (1:1 per PaymentAccount)
- **Not used as recon identity:** legacy Prisma `BankAccount`

## Authority

| Concern | Authority |
|---|---|
| Statement rows | External evidence (`BankRecStatementTransaction`) |
| Book candidates | Posted `JournalEntryLine` on bank CoA, `architectureVersion = ACCOUNTING_V2` |
| Matches | `BankRecMatch` / `BankRecMatchLink` — never mutate JE lines |
| Adjustments | Posting Engine / banking adapters / manual adjustment journals |
| Completion | Atomic status + immutable `BankRecSnapshot` |
| Period close | Live feed → `BANK_RECONCILIATION_REVIEWED` (checklist v1.1.0) |

## Package layout

See `CURRENT_BANK_RECONCILIATION_ARCHITECTURE.md`. Runtime lives under `lib/bankReconciliation/` with APIs at `/api/bank-reconciliation/**` and UI at `/bank-reconciliation`.

## Feature flags

- `bankReconciliationV2Enabled`
- `bankReconciliationAutoMatchEnabled`
- `bankReconciliationPeriodCloseFeedEnabled`
- `bankReconciliationOfxImportEnabled`
