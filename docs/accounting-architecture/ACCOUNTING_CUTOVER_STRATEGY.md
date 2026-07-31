# Accounting Cutover Strategy

Core invariant: **for any single accounting event, exactly one engine may create active
financial effects.** Enforced by (a) server-side posting-mode resolution per
business+module+event, (b) the registry unique identity — once an event is POSTED by either
path through the coordinator, a second active posting is a constraint violation, and
(c) Phase 4's activation step which disables the legacy trigger for the exact scope that
NEW_ENGINE takes over — never both.

## Entering shadow mode (business or module)

1. Administrator (with `accountingArchitecture.configure`) creates the tenant's
   `AcctV2Configuration` with `enableShadowAccounting: true` and reason (audited).
2. Enable `accountingV2ShadowMode` for the scope (tenant, or tenant+module) — audited.
3. Performance review: shadow adds one registry insert + shadow rows per event; verify
   volume headroom before enabling high-throughput modules (POS).
4. Monitor `/system/accounting-architecture` and the `architecture` audit module.

## Reviewing comparisons

Weekly (minimum) review of `AcctV2ShadowComparison` grouped by status. Every
non-EXACT_MATCH is dispositioned: legacy defect (expected difference — document), V2 template
bug (fix in Phase 4 code), or data issue (Phase 6 backlog). ARCH-003 keeps unreviewed
critical findings visible.

## Activation approval

NEW_ENGINE activation (Phase 4+) requires, per business+module: acceptance thresholds met
(see `DATA_TRANSITION_STRATEGY.md`), sign-off by the business owner and the engineering lead,
`accountingV2Enabled` flag for the exact scope, configuration baseline change — each step
audited with reason. The Phase 2 API refuses this flag entirely, so premature activation is
impossible in this release.

## Switching reports

Reports switch after posting (not with it): `accountingV2NewLedgerQuery` then
`accountingV2NewTrialBalance` per business, with a mandatory side-by-side comparison window
(both computed, legacy displayed) before the flag flips display.

## Rollback

1. Set the scope's flags back (LEGACY baseline) — immediate, server-side, audited.
2. Events already posted by the new engine stay valid (they are real journals with full
   lineage); the registry marks the boundary so reconciliation is deterministic.
3. If containment is needed: `accountingV2AuditOnly` or `DISABLED` mode stops non-legacy
   activity instantly.

## Partially migrated businesses

Posting mode resolves per module/event-type, so a business can run NEW_ENGINE for EXPENSES
while SALES stays LEGACY. The registry records the mode used per event
(`postingMode`, `architectureVersion`), which is how new-architecture transactions are
distinguished from legacy ones forever.
