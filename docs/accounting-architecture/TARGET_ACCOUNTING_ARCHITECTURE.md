# Target Accounting Architecture

## Controlled path

```
Operational Transaction (Invoice, Sale, Bill, Expense, Payroll run, …)
        ↓  (route handler builds AccountingContext from session + validated Zod command)
Accounting Posting Command        — sourceReference, eventType, dates, dimensions, draft
        ↓
Central Accounting Posting Engine — postAccountingEvent (Phase 2: transition coordinator;
        ↓                            Phase 4: full engine with posting templates)
Balanced Journal Entry            — JournalDraft validated (balance, lines, dimensions)
        ↓
Immutable Journal Entry Lines     — posted records never edited; corrections via reversal
        ↓
General Ledger Read Model         — GeneralLedgerQueryService (legacy adapter now, V2 Phase 5)
        ↓
Trial Balance                     — TrialBalanceQueryService (legacy adapter now, V2 Phase 7)
        ↓
Financial Statements              — read posted lines only (ADR-001/ADR-012)
        ↓
Management Reports and Projections
```

## The fifteen guarantees and their mechanisms

| # | Guarantee | Mechanism (Phase 2 status) |
|---|---|---|
| 1 | One accounting identity per financial event | `SourceReference` + canonical idempotency key (**live**) |
| 2 | ≤ 1 active posting per accounting event | `AcctV2EventRegistry` unique constraints, DB-enforced (**live**) |
| 3 | Journals balance before commit | `createJournalDraft` structural validation (**live**); engine re-check in Phase 4 |
| 4 | One business per journal | Mandatory `AccountingContext` + `assertSameBusiness` in every repository (**live**) |
| 5 | One accounting period per journal | `PeriodResolutionService` deny-by-default (**contract live**, calendar in Phase 8) |
| 6 | Journal linked to source | registry `sourceModule/Type/Id/eventType` columns + indexes (**live**) |
| 7 | Posted journals immutable | `JournalRepository` exposes no update/delete; `JournalImmutableError`; boundary tests (**live for V2 surface**; legacy tables in Phase 5) |
| 8 | Corrections via reversal/adjustment | `REVERSAL_POSTED`/`ADJUSTMENT_POSTED` event types + `ReversalService` contract (**contract live**) |
| 9 | Reports read posted records only | ADR-012 + boundary tests forbidding shadow/operational reads in new code (**tests live**; legacy reports migrate Phase 7) |
| 10 | Operational modules cannot alter FS balances | boundary test: V2 code cannot write legacy financial tables; only adapters may delegate (**live**) |
| 11 | All accounting actions auditable | posting attempts + outbox + `AuditLog` extension (**live**) |
| 12 | Strict tenant isolation | context-scoped repositories, session-derived tenant, cross-tenant errors (**live**) |
| 13 | Safe historical transition | additive schema, architecture versioning, no deletes (**live**) |
| 14 | Controlled legacy/new coexistence | posting modes + server-side flags, default LEGACY (**live**) |
| 15 | Provable figure origins | registry → journal → source lineage columns + correlation ids (**live for V2 records**) |

## Layering rules

- **Domain** (`domain/`): pure, no Prisma, no Next.js, no legacy imports. Enforced by tests.
- **Application** (`application/`): orchestrates domain + infrastructure; owns posting modes.
- **Infrastructure** (`infrastructure/`): Prisma access, transaction boundary, flags, outbox.
- **Legacy adapters** (`infrastructure/legacy/`): the only files allowed to import legacy
  accounting modules. Enforced by boundary tests.
- **Transport** (`app/api/**`): session auth → context construction → Zod validation → service
  call. No accounting rules in route handlers.
- **UI**: no Prisma, no V2 infrastructure imports. Enforced by boundary tests.

## Command/query separation

Commands (`postAccountingEvent`, future reverse/close) run inside the transaction boundary and
are the only V2 code paths that write. Query services (`generalLedgerQueryService`,
`trialBalanceQueryService`, `reversalService.getReversalState`) are read-only by construction
and test.
