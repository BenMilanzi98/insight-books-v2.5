# Target Posting Engine Architecture (as implemented)

## Controlled path

Every posting flows through `lib/accountingV2/engine/postingEngine.js`:

```
PostingCommand (strictly typed input)
  → Accounting context + permission checks
  → Posting-mode resolution (server-side, feature flags)
  → Validation pipeline (deterministic order — validationPipeline.js)
      command → business scope → template → source → approval
      → period → draft generation → account validation → double entry
  → Phase A: claim accounting event (AcctV2EventRegistry, idempotent)
  → Phase B: atomic posting transaction
      journal number → JournalEntry + lines → event linkage
      → source posting state → audit record → outbox events
  → PostingResult (standardized output)
```

## Layering

| Layer | Files | Rules |
| --- | --- | --- |
| Domain | `lib/accountingV2/domain/*` | Pure. No Prisma, no Next.js, no legacy imports (enforced by `test/accountingV2.boundaries.test.js`). Enums, errors, money, journal draft, status machines, dimension policy. |
| Engine | `lib/accountingV2/engine/*` | Orchestration + persistence of postings. Only `journalPersistence.js` (and the manual-journal draft service) may write `JournalEntry`/`JournalEntryLine`. |
| Templates | `lib/accountingV2/templates/*` | Versioned, immutable-once-registered template catalogue. 4 ACTIVE pilots + 19 DEFINED for Phase 9. |
| Application | `lib/accountingV2/application/*` | Workflow services (manual journal, opening balance). Enforce permissions and status transitions; delegate posting to the engine. |
| Infrastructure | `lib/accountingV2/infrastructure/*` | Event registry repository, feature flags, outbox, audit trail, transaction boundary, legacy adapters. |
| API | `app/api/accounting-v2/*` | Transport only. `routeGuard.js` handles auth/permissions/error mapping. No debit/credit logic in routes. |
| UI | `app/system/accounting-posting-engine/page.js` | Read-only diagnostics. |

## Key decisions

1. **Shared journal store, additive columns.** V2 journals are persisted in the
   existing `JournalEntry`/`JournalEntryLine` tables with additive columns
   (`journalNumber`, `templateId`, `templateVersion`, `architectureVersion`,
   `accountingEventId`, `postingMode`, totals, period linkage, …). This keeps
   V2 posted journals visible to existing reports without a parallel ledger,
   and lets Phase 5 build the General Ledger from one table.
2. **Two-phase transaction model.** Phase A claims the event identity in a
   short transaction (durable even if posting later fails, giving an auditable
   failure record); Phase B performs all financial writes atomically. Any
   Phase B failure rolls back journal, lines, source state, audit and outbox
   together, then the event is marked `FAILED` with a retryability
   classification.
3. **Posting mode is resolved server-side** from `AcctV2FeatureFlag` scope
   (business/module/event). Default is `LEGACY`; the client can never override
   the mode, the architecture version, or approval status.
4. **Mutual exclusion with legacy** is enforced in both directions by
   `engine/legacyGuard.js`, called from `lib/accountingEngine/postGlEntry.js`
   and `lib/journalService.js` (legacy side) and from the engine's posting
   transaction (V2 side).
5. **Templates are code, not user configuration.** Registered classes/objects
   in `templates/`; published versions are frozen; changes require a new
   version. Every posted journal stores template ID + version.

## What the engine guarantees

The 24 guarantees from the Phase 4 objective are implemented as follows:
event identity + single active posting (registry unique keys, §IDEMPOTENCY),
balance (double-entry validation, DB check constraint `je_v2_posted_requirements`),
account validity (accountValidation.js against CoA V2), period enforcement
(periodResolution.js), source linkage + actor recording (journal columns),
atomicity (transactionBoundary + single Prisma transaction), immutability
(journalStatus.js + persistence guards), no partial effects (rollback tests),
idempotent retries (registry replay), typed traceable failures (errors.js +
posting attempts), legacy/new exclusion (legacyGuard), shadow isolation
(AcctV2ShadowJournal tables only), exact decimals (domain/money.js, decimal
strings end-to-end), template traceability (journal columns), tenant isolation
(business scoping everywhere + tests), verifiability (audit + attempt records).
