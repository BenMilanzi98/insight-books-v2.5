# Target Financial Calendar Architecture

## Flow

```
AcctV2FinancialCalendarConfig (per business)
        ↓
AcctV2FinancialYear (canonical, non-overlapping)
        ↓
AcctV2AccountingPeriod (12 monthly, generated atomically, no gaps/overlaps)
        ↓
resolvePeriodV2 (posting date → year + period, deny-by-default)
        ↓
Posting Engine (Phase 4 pipeline stores accountingPeriodId + financialYearLabel)
        ↓
Journal Entry / General Ledger (Phase 5)
        ↓
Period Close Run + versioned checklist + exceptions + approvals
        ↓
Atomic closure → immutable snapshots (Phase 7 report runs)
        ↓
Controlled reopening → restricted corrections → re-close (new run version)
```

## Design decisions

1. **Additive canonical models.** The legacy `AccountingPeriod` table is kept
   untouched; new `AcctV2*` tables carry the canonical calendar. Legacy monthly
   periods are aliased via `AcctV2AccountingPeriod.legacyPeriodId` during
   migration.
2. **Deny-by-default resolution.** `resolvePeriodV2` throws typed errors for
   any date without exactly one covering OPEN/authorized period. There is no
   silent fallback to the current period.
3. **Server-controlled statuses.** The only writes to `status` go through
   `transitionPeriod`, which enforces `PERIOD_TRANSITIONS` and writes history.
   No API exposes a generic status update.
4. **Close as a workflow, not a flag.** `AcctV2PeriodCloseRun` + tasks +
   exceptions + approvals; closure happens in one transaction after all
   blocking checks pass and a second person has approved.
5. **History is append-only.** Close runs are superseded (`SUPERSEDED`)
   rather than overwritten; snapshots from Phase 7 are superseded rather than
   deleted; status history rows are never edited.
6. **Feature-flag rollout.** `PERIOD_FLAGS` (calendar, resolver, strict
   posting, close/reopen workflows, monitoring) gate every behavioural change;
   with flags off, the Phase 4 legacy-compatible resolver still runs.
