# Phase 8 Scope

## In scope

1. **Customer Health Intelligence** — versioned definition, dimension evaluation, confidence, critical overrides, immutable snapshots, recon, APIs, workbench UI.
2. **Customer Success Ops** — Command Centre, cases, tasks, interventions, renewals workspace, playbook + success-plan foundations, expansion handoffs (record-only), export.
3. Reuse Phase 7: 360, commercial, engagement login proxy, MRA EIS, portfolios/ownership, signals, portfolioScope, metric envelopes.
4. Permissions: `systemAdmin.intel.customerHealth.*` + `systemAdmin.customerSuccess.*`.
5. en/ny i18n; AdminShell nav maps.

## Explicitly out of scope / deferred

| Item | Disposition |
|------|-------------|
| Lead Management / CRM opportunities | Later phase (user deferred) |
| ML / AI health or outreach | Forbidden |
| FEATURE_USED adoption scoring | N/A until emitters |
| Unique-user DAU health dim | N/A until instrumented |
| Support ticket-driven health | N/A until SupportTicket |
| Invented onboarding/training % | Forbidden; source-gated UI only |
| Auto plan upgrade / credit / refund / cancel | Forbidden |
| Tenant GL / Tenant Sale as SaaS metrics | Forbidden |
| Full survey NPS product | Foundation only if responses exist |

## Exit expectation

**READY_FOR_PHASE_9_WITH_BLOCKERS** if Health + core CS ops are safe while adoption/support/onboarding remain uninstrumented and explicitly labelled.
