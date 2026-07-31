# Open-Period Controls

An OPEN period permits authorized ordinary postings — nothing more.

`resolvePeriodV2` still validates, for every posting into an OPEN period:

1. The period and year belong to the session business (all queries
   `tenantId`-scoped).
2. The posting date lies within the period (inclusive boundaries).
3. The financial year is OPEN (a CLOSED/ARCHIVED year rejects even if a
   period row were open).
4. The date is after any lock date (period `lockDate` and business default
   lock rules).
5. Backdating/future-dating policy passes for the date.
6. The caller holds the required posting permissions where policy demands
   them (backdated → `accountingPeriods.postBackdated`, etc.).

OPEN status does **not** bypass the rest of the Phase 4 pipeline: account
validation, approvals, idempotency, source validation and double-entry
balancing still run after period resolution.
