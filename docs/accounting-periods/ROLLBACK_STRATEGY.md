# Rollback Strategy

## Rollback levers (in order of preference)

1. **Flags off** — disabling `RESOLVER_V2` / `STRICT_POSTING` returns period
   resolution to the Phase 4 legacy-compatible path instantly; disabling
   `CLOSE_WORKFLOW` / `REOPEN_WORKFLOW` hides the new workflows. No data
   change required.
2. **UI route** — remove the `/financial-calendar-v2` sidebar links; the
   legacy `/accounting-periods` page is untouched and keeps working.
3. **Schema** — the migration is additive; it may be rolled back **only**
   while no dependent rows exist (no canonical years created). After
   migration has run for a business, the tables stay.

## Rollback preserves (never deleted or rewritten)

- Canonical financial years and periods.
- Close-run history, tasks, evidence and exceptions.
- Report snapshots (including superseded generations).
- Period status history.
- Journal period references assigned by migration (harmless under legacy
  resolution — legacy code ignores them).

## Rollback must never

Delete closed-period history or snapshots, reopen periods silently, change
journal amounts, move journals between periods, delete status history, or
hide exceptions. None of the rollback levers above can do any of these — the
only mutation is flag state.
