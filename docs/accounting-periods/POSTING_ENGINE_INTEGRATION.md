# Posting Engine Integration

`lib/accountingV2/engine/periodResolution.js` (`resolvePostingPeriod`) is the
single period entry point of the Phase 4 validation pipeline
(`validationPipeline.js`).

## Flag-gated delegation

- `PERIOD_FLAGS.RESOLVER_V2` **on** (per business/module/event): the pipeline
  delegates to `resolvePeriodV2`; the journal receives the canonical
  `accountingPeriodId`, `financialYearId` and `financialYearLabel`, plus
  resolution metadata (`isBackdated`, `resolutionRule`).
- Flag **off**: the Phase 4 legacy-compatible resolution continues unchanged
  (controlled rollout / rollback path).

## Order inside the pipeline

1. Accounting Context validation (business, user, source reference).
2. Transaction date and requested posting date extraction from the Posting
   Command — `sourceModule`, `sourceType`, `eventType` are forwarded so
   module-level flags and policies apply.
3. `resolvePostingPeriod` → year + period + policy outcome (throws on any
   violation; posting fails before a journal row exists).
4. Remaining journal validation (accounts, balance, idempotency) proceeds
   with the resolved period attached.

## Guarantees

- The engine never trusts a client-supplied period ID; the Posting Command
  does not even carry one — only dates.
- Journals store the resolved year and period server-side.
- Failed resolution = no journal, source stays unposted, rejection audited.
