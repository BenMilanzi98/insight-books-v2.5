# Target Operational Integration Architecture

```
Operational Transaction (Invoice, Sale, Bill, Expense, …)
        ↓
Module Accounting Adapter (load → validate → build command)
        ↓
Accounting Context + Source Reference + Idempotency Key
        ↓
Period Resolution Service (Phase 8)
        ↓
Account Mapping Service (Phase 3)
        ↓
Posting Template buildDraft (ACTIVE)
        ↓
executePosting (Phase 4 engine)
        ↓
AcctV2EventRegistry + Immutable Journal + Outbox
        ↓
getSourcePostingState → Operational UI
        ↓
Module Reconciliation vs Control Accounts
```

## Design decisions (binding)

1. **Reuse, do not replace, the Phase 4 kernel.** Adapters call `executePosting` /
   `previewPosting` / `retryPosting`. No new journal writers.
2. **Source link = `AcctV2EventRegistry`.** No new `SourceAccountingLink` table
   unless a denormalized cache is later required for UI performance.
3. **Standard adapter contract** in `lib/accountingV2/adapters/` — every module
   implements the same lifecycle methods.
4. **Cutover modes** already exist (`resolvePostingMode`): LEGACY → SHADOW →
   NEW_ENGINE / DISABLED. Module flags extend `KNOWN_FLAGS` for observability;
   mode remains the authority.
5. **Legacy shutdown:** (a) expand `LEGACY_SOURCE_SCOPE` so every event is
   mode-gated; (b) wrap or replace bypass writers so they cannot write when
   NEW_ENGINE owns the event; (c) delete dead dual-write code only after
   cutover evidence.
6. **Failure policy (default):** operational record may persist with
   `POSTING_FAILED` visible; retry via engine. Events that require atomic
   ops+accounting opt into a single DB transaction in the adapter.
7. **Reports stay GL-sourced.** Module reconciliations never become statement truth.

## Cutover sequence (prompt §78)

1. Bank charges / interest / simple cash expenses  
2. Invoices + customer payments + supplier bills/payments  
3. POS + inventory receipt + COGS + adjustments  
4. Payroll  
5. Fixed assets + depreciation + disposals  
6. Loans + tax settlements + equity  
7. Imports + webhooks + scheduled jobs  
