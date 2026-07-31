# Journal Validation Pipeline

Implementation: `lib/accountingV2/engine/validationPipeline.js`
(`runValidationPipeline`), shared verbatim by preview and posting.

## Deterministic stage order

1. **Command validation** — already guaranteed by `createPostingCommand`
   (schema, dates, decimals, identity).
2. **Authentication / authorization** — session + permission checks happen in
   `api/routeGuard.js` and the application services before the pipeline runs;
   the pipeline re-asserts the business scope.
3. **Business-scope validation** — context business exists and matches every
   loaded entity.
4. **Template validation** — active template resolved for the event type;
   version effective at posting date.
5. **Source validation** — typed validator (existence, ownership, postable
   status, value consistency, required evidence).
6. **Approval validation** — requirement resolution + stored-approval checks,
   separation of duties.
7. **Period resolution** — financial year, period, closed/backdate/future
   rules.
8. **Journal draft generation** — template `buildDraft`.
9. **Account validation** — per-line CoA V2 checks (see
   `ACCOUNT_VALIDATION.md`), dimension and currency policy.
10. **Double-entry validation** — see below.
11. **Final pre-persistence validation** — structural invariants on the draft
    immediately before the transaction.

## Modes

- `strict` (posting): throws the first typed error; nothing is persisted.
- `collect` (preview): accumulates **all** issues and warnings and returns
  them with the draft, so users see every problem at once.

No partial records are persisted before final validation. The only
pre-validation write is the Phase A event claim, which exists precisely to
make failures durable and auditable (`AcctV2PostingAttempt`).

## Double-entry rules enforced

Total debit = total credit (transaction and base currency); at least two
meaningful lines; each line has either debit or credit, never both; no
negative or zero-only values; no NaN/Infinity; no unsupported scale; rounding
differences outside tolerance are rejected — never auto-balanced through a
suspense account (`UnbalancedJournalError`).
