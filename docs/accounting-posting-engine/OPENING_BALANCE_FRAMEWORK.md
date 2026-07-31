# Opening Balance Framework

Implementation: `lib/accountingV2/application/openingBalanceService.js`,
`AcctV2OpeningBalanceBatch` table, `OPENING_BALANCE` template,
`OPENING_BALANCE_POSTED` event type. API:
`app/api/accounting-v2/opening-balances/*`.

## Batch lifecycle

`DRAFT → SUBMITTED → APPROVED → POSTED` (or `CANCELLED` before posting).
Actions: create, submit, approve, cancel, preview, post — each behind its
permission (`openingBalances.create/approve/post`).

## Rules enforced

1. **Balanced** — total debits must equal total credits at creation and again
   at posting (`UnbalancedJournalError`).
2. **Unique** — DB unique constraint on `(tenantId, effectiveDate, version)`;
   a duplicate batch for the same business/date/version is refused.
3. **Evidence required** — `evidenceReference` is mandatory.
4. **Approval required** — with separation of duties (creator ≠ approver).
5. **Opening Balance Equity** — the `OPENING_BALANCE_EQUITY` purpose from the
   Phase 3 system-account registry balances the entry per approved policy.
6. **Subledger dimensions** — AR lines require `customerId`, AP lines require
   `supplierId` (control-account dimension validation); inventory lines
   require valuation support; fixed assets require asset-register references.
7. **Cannot repeat** — posting goes through the engine's idempotency layer;
   the batch's event identity is unique, so accidental re-posting replays the
   original result instead of double-counting.
8. **Immutable after posting** — the resulting journal (`OB-YYYY-NNNNNN`,
   `entryType: 'OpeningBalance'`) is immutable; corrections require reversal
   or an `OpeningBalanceCorrection` adjustment, or a new batch version.
9. **Not mixed with ordinary transactions** — dedicated event type, entry
   type and template.
10. **Business-scoped** — cross-business batch access is refused (tested).

Supported balance classes: cash, bank, AR, inventory, prepayments, fixed
assets, accumulated depreciation, AP, taxes, loans, capital, retained
earnings, and other valid balances — constrained only by account validation.

**No automatic migration**: Phase 4 does not migrate historical opening
balances; the framework exists for controlled onboarding, with migration
decisions deferred per `POSTING_ENGINE_MIGRATION_STRATEGY.md`.

Tests: opening-balance suite — balanced posting end-to-end, unbalanced
refusal, duplicate batch refusal, AR-without-customer refusal, missing
evidence, self-approval refusal, cross-business refusal.
