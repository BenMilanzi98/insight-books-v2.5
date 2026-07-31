# Phase 9 Scope

## In scope

1. Repo-backed Product taxonomy (areas → modules → features → cadence/lifecycle).
2. Plan/add-on entitlement resolution using historical plan versions.
3. Server-verified meaningful Product Events via Phase 4 plane (commerce core first).
4. First-value / repeat-value / activation / adoption engines for **instrumented** features only.
5. Product Analytics workbench UI with honesty gates for everything else.
6. Funnels, cohorts, retention, signals, recon, export (instrumented scope).
7. Read-only integrations with Executive / Customer 360 / Health / CS.
8. en/ny; portfolio + user-level permission splits.

## Explicitly out / deferred

| Item | Disposition |
|------|-------------|
| Live metrics from domain table counts without AnalyticsEvent | Forbidden (strict events) |
| Page-view / login-as-adoption | Forbidden |
| Session replay / keylogging / Tenant GL content | Forbidden |
| Full Android product usage SDK | NOT_INSTRUMENTED (update telemetry only) |
| Broad FEATURE_USED across all modules in Wave 1 | Deferred — commerce first |
| Auto plan upgrade / CRM opportunity / customer outreach | Forbidden |
| Lead Management / full Support desk | Later phases |
| AI product recommendations | Forbidden |

## Exit expectation

**READY_FOR_PHASE_10_WITH_BLOCKERS** when commerce-core path is trustworthy and remaining modules/Android/full funnels are explicitly blocked.
