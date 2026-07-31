# Phase 9 Inputs (from Phase 8)

| Asset | Path / surface |
|-------|----------------|
| Health catalogue / evaluate / snapshots | `lib/admin/health/*` (`customer-health-2026-07-28`) |
| Health APIs | `/api/admin/intelligence/customer-health/*` |
| Health workbench UI | `/insightbooks/intelligence/customer-health/*` |
| CS catalogue / authz | `lib/admin/customerSuccess/catalogue.js`, `authz.js` |
| Cases / tasks / interventions / renewals | `cases.js`, `tasks.js`, `interventions.js`, `renewals.js`, `automation.js` |
| Playbooks / plans / handoffs / foundations / export | `playbooks.js`, `plans.js`, `handoffs.js`, `foundations.js`, `export.js` |
| CS APIs | `/api/admin/customer-success/*` |
| CS UI | `/insightbooks/customer-success/*` |
| Prisma CS models | `CsCase`, `CsTask`, `CsIntervention`, `CsRenewalWorkspace`, `CsPlaybook`, `CsPlaybookExecution`, `CsSuccessPlan`, `CsSuccessGoal`, `CsExpansionHandoff`, foundation stubs |
| SQL fallback | `scripts/sql/customer-success-phase08.sql` |
| Workflow / security matrices | `CS_WORKFLOW_MATRIX.md`, `CS_SECURITY_MATRIX.md` |
| Health missing-data matrix | `HEALTH_MISSING_DATA_MATRIX.md` |
| Final Phase 8 | `FINAL_PHASE_08_REPORT.md` — **READY_FOR_PHASE_9_WITH_BLOCKERS** |

**Reuse from earlier phases:** Phase 7 360 / signals / portfolios; Phase 6 platform commercial; authz / `authorizeAdminDecision`; Admin audit log; metric envelopes.

**Do not consume as truth:** Tenant Sale; invented adoption/support/onboarding/training progress; opaque churn probability; auto plan upgrades from expansion handoffs; CS cases as support tickets.
