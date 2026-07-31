# Legacy Posting Guard

Implementation: `lib/accountingV2/engine/legacyGuard.js`, wired into both
posting stacks.

## Both directions are guarded

**Legacy → V2 conflict** — `assertLegacyPostingAllowed({ tenantId, sourceType,
sourceId }, db)` is called by:

- `lib/accountingEngine/postGlEntry.js` before any legacy GL write.
- `lib/journalService.js#postEntry` before posting a legacy journal.

It throws `LegacyAndNewPostingConflictError` when (a) the resolved posting
mode for the source's mapped module/event is `NEW_ENGINE` (mode ownership), or
(b) a V2 event registry row already shows an active posting for that source
(existing effect). Legacy `sourceType` values are mapped to V2 module/event
identities inside the guard, so legacy callbacks, queue workers, webhooks and
imports all hit the same refusal — they share these entry points.

**V2 → legacy conflict** — `assertNewEnginePostingAllowed(tx, context, ref)`
runs inside the V2 posting transaction and refuses to post when an active
legacy `Transaction` exists for the same source.

## Additional protections

- `LEGACY` mode: the engine refuses active production posting outright (may
  shadow where configured) — tested ("LEGACY mode refuses active V2 posting").
- `DISABLED` mode: all posting refused (emergency containment).
- Shared DB constraints (`JournalEntry.accountingEventId` unique, registry
  idempotency key unique) backstop the application guards.
- Legacy mutation of V2 journals is blocked: `journalService.postEntry`,
  `voidEntry` and `createReversalEntry` reject rows with
  `architectureVersion === 'ACCOUNTING_V2'`.
- Runtime guard for unauthorized direct journal creation: the boundary test
  suite (`test/accountingV2.boundaries.test.js`) statically forbids any V2
  module outside the approved writers from calling
  `journalEntry.create/update/delete`, and legacy report code from touching
  shadow tables.

Tests: "legacy↔new posting guard" suite — legacy refused in NEW_ENGINE mode,
legacy refused after a V2 posting, V2 refused over an active legacy posting,
and legacy staying open in pure LEGACY mode.
