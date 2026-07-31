# Service Boundaries and Contracts

Contracts: `lib/accountingV2/contracts/serviceContracts.js` (method lists + runtime
`assertImplements` + registered implementations). API schemas:
`lib/accountingV2/contracts/apiSchemas.js` (Zod; decimal strings for money; enums validated;
pagination capped at 500; DB models never exposed raw).

| Contract | Methods | Phase 2 implementation | Future |
|---|---|---|---|
| AccountingPostingService | `post(command)` → result with eventId, mode, journalId, comparisonStatus, existingPosting, requestId/correlationId, warnings | Transition coordinator (`postAccountingEvent`) | Phase 4: full engine + templates |
| AccountMappingService | `resolveMappedAccount(context, key)` — 18 mapping keys incl. AR/AP/revenue/COGS/VAT in+out/payroll/loans/assets/equity family | Legacy-code-backed; missing → `MissingAccountMappingError`, inactive → `InactiveAccountError`, header → `NonPostingAccountError`. No silent fallback | Phase 3: configured mapping registry |
| PeriodResolutionService | `resolvePeriod(context, date)` → decision OPEN/CLOSED/NO_PERIOD/AMBIGUOUS, `postingAllowed` (deny-by-default), `legacyWouldAllow` | Legacy period rows, strict policy | Phase 8: financial calendar |
| JournalRepository | `findEventByIdempotencyKey`, `findEventsBySource`, `findLegacyPostingsBySource` — **no update/delete of posted journals** (tested) | Registry + read-only legacy lookups | Phase 5: V2 journal persistence |
| GeneralLedgerQueryService | `getLedgerTotals(context, range)`, `getAccountActivity(context, accountId, range)` (paginated, capped 1000) | Legacy adapter | Phase 5: V2 read model; subledger dimensions (customer/supplier/owner/bank) ride on `dimensions` JSON of V2 lines |
| TrialBalanceQueryService | `getTrialBalance(context, {startDate, endDate, branchId, includeZero})` → account code/name, opening/period/closing Dr/Cr, parent, category, drill-down ref | Legacy adapter (TB-003 documented) | Phase 7 |
| ReversalService | `getReversalState(context, transactionId)` → ReversalStatus + originals + reversal rows | Read-only legacy adapter | Phase 5/9: execution with reason, authorization, period checks, duplicate prevention via `REVERSAL_POSTED` identity |
| Audit & integrity | Phase 1 engine + `architecture` module (ARCH-001…008): pre/post-post validation hooks arrive with the engine | Read-only | Phase 4+ |

## Module contracts (Accounting navigation)

- **General Ledger** — reads via GeneralLedgerQueryService only; drill-down =
  line → transaction → sourceType/sourceId → registry event (V2 records). Caching: none in
  Phase 2; V2 read model defines cache invalidation on posting commit (Phase 5).
- **Receivables / Payables** — operational subledgers reconciled to control accounts; event
  identities defined (`INVOICE_POSTED`, `CUSTOMER_PAYMENT_POSTED`, `SUPPLIER_BILL_POSTED`,
  `SUPPLIER_PAYMENT_POSTED`, credits/refunds); customer/supplier dimensions required by policy;
  reconciliation currently via the Phase 1 `ar-ap` audit module (control vs subledger).
- **Accounting Periods** — PeriodResolutionService; closed-period policy deny; posting date vs
  transaction date carried separately on registry (`transactionDate`, `requestedPostingDate`);
  reopen requires `periods.reopen` permission.
- **Chart of Accounts** — `AccountBehaviour` types, mapping service, posting-account
  validation (`NonPostingAccountError`); hierarchy rules documented for Phase 3; no merges yet.
- **Journal Entries** — canonical statuses (`JournalStatus`), source lineage, approval fields
  (`ApprovalStatus`, config `requireJournalApproval`), architecture version, immutability
  (`JournalImmutableError`; repository exposes no mutation).
- **Capital Account** — owner/shareholder dimensions (require-one-of policy), equity event
  types (contribution, drawing, dividends declared/paid), mapping keys for capital/retained
  earnings/opening-balance equity; separation of capital vs drawings vs retained earnings vs
  current-year profit is a mapping + event-type concern; historical repair deferred (Phase 6/11).
- **Trial Balance** — TrialBalanceQueryService; hierarchy presentation rules (header exclusion)
  specified for the Phase 7 implementation; comparative-period inputs in the query schema.
- **Reversals** — ReversalService; original-journal linkage; duplicate-reversal prevention by
  event identity; approval via `requireReversalApproval` config.
