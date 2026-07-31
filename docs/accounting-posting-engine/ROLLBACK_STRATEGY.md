# Rollback Strategy

Guiding rule: **rollback never deletes valid posted journals or erases
accounting evidence.**

## Behavioural rollback (primary, always available)

1. Flip the affected `(business, module, eventType)` flag scope back to
   `LEGACY` (audited, reason required). Future events post through the legacy
   path again; the legacy guard stops refusing them the moment the mode
   changes.
2. Or set the scope to `DISABLED` to stop all posting for that event while
   investigating.
3. V2-posted journals remain in place, visible to reports (legacy-compatible
   status strings) and readable through all V2 APIs.
4. New V2 submissions stop; drafts can still be cancelled.
5. Errors in V2-posted journals are corrected through authorized reversals or
   adjustment journals — never by deletion or in-place edits.

## Schema rollback (constrained)

Additive columns/tables may be dropped **only where no V2 records depend on
them**. Once any V2 journal exists, `JournalEntry` V2 columns and the event
registry extensions must be preserved (they are nullable and inert for legacy
rows, so retaining them has no legacy cost). `AcctV2JournalSequence` and
`AcctV2OpeningBalanceBatch` rows are audit evidence once used.

## What is never done

- Deleting posted journals or journal lines.
- Rewriting event registry history or audit records.
- Resetting journal-number sequences (gaps are auditable, reuse is not).
- Simulating rollback by erasing posted accounting evidence.

## Rehearsal

The rollback drill for Stage 3+ is: activate `NEW_ENGINE` for a pilot scope in
staging → post a manual journal → flip back to `LEGACY` → verify (a) the
legacy path accepts new manual journals again, (b) the V2-posted journal is
intact and reported, (c) attempting a legacy void of the V2 journal is
refused, (d) audit trail shows the mode change with actor and reason.
