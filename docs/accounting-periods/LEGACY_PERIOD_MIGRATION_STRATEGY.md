# Legacy Period Migration Strategy

Service: `lib/accountingV2/periods/legacyPeriodMigrationService.js`;
API: `POST /api/accounting-v2/periods/migration` (`preview` | `execute`).

## Legacy defects handled

Overlapping Monthly/Yearly rows, arbitrary names, lazily created periods,
journals without period references, closed/open inconsistencies, missing
status history, date-only assumptions (see
CURRENT_FINANCIAL_CALENDAR_ARCHITECTURE.md).

## Stages

**Stage 1 — preview (read-only).** Inventories legacy periods (Monthly vs
Yearly), detects overlaps and gaps among monthly rows, counts posted journals
without canonical assignment, and proposes the canonical financial years
covering all legacy dates, journal dates and today.

**Stage 2 — canonical structures.** For each proposed year not yet present:
create the year + 12 periods atomically; alias matching legacy monthly rows
via `legacyPeriodId`; carry legacy `closed` status onto the canonical period
(status CLOSED with a `MIGRATED` history row noting the preserved metadata).
Yearly legacy rows are treated as aliases, never calendar authorities. No
dates are invented.

**Stage 3 — journal assignment.** Posted journals with NULL
`accountingPeriodId` are assigned from their **posting/entry date** only when
exactly one canonical period covers the date. Ambiguous or dateless journals
remain as `unresolved` exceptions. Amounts, dates and statuses are never
touched (statically enforced by the architecture boundary test).

**Stage 4 — validation.** Trial Balance and GL comparisons via the Phase 5/7
reconciliation services; `assertMigrationComplete` blocks strict flags while
unassigned posted journals remain.

**Stage 5 — rollout.** Enable `RESOLVER_V2`/`STRICT_POSTING` business by
business once readiness is READY (see CONTROLLED_ROLLOUT.md).

The migration is idempotent: existing canonical years are skipped and
assignment only fills NULL references; each batch is audited
(`acctv2.period.legacyMigration`).
