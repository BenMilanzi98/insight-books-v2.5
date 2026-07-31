# Phase 7 Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Residual |
| --- | --- | --- | --- | --- | --- |
| R1 | Legacy charts lack CoA V2 classification, so line mapping falls back to name heuristics and misclassifies an account | Medium | Medium | Explicit classification always wins; assisted mappings raise `MAPPING_ASSISTED` warnings; unmapped report forces review; Phase 3 mapping completion is a cutover condition | Low |
| R2 | Users trust legacy `/reports` figures during the comparison window while V2 disagrees | High | Medium | Differences are expected and documented as legacy defects; Stage 3 comparison requires explanation per difference before cutover | Low |
| R3 | Department/project/cost-centre statements requested before dimension capture exists | Medium | Low | Contract accepts the parameters; statement-level slicing deferred with disclosure (DIMENSIONAL_REPORTING.md); drill-down offers UNASSIGNED-aware filters | Low |
| R4 | Large-volume performance on production PostgreSQL unproven | Medium | Medium | Grouped-aggregation design, indexes, cache; Stage 2 benchmark is a hard gate | Medium until Stage 2 |
| R5 | Open Phase 6 historical exceptions make TB/BS UNVERIFIED indefinitely | Medium | Medium | Correct behaviour by design — disclosure, not suppression; business sign-off path exists for accepted exceptions (BALANCED_WITH_WARNINGS) | Accepted |
| R6 | Cache staleness window if the data-version fingerprint misses a write path | Low | Medium | Fingerprint covers legacy + V2 posting tables; `reconcileReportCache` (REP-030) detects any drift; stale entries regenerate on read | Low |
| R7 | Report approval by a user who also generated the report | Low | Low | Distinct permissions for review/approve; role assignment is an admin responsibility; all actions audited | Low |
| R8 | Legacy dashboard KPIs continue to disagree with statements until Stage 7 | High | Low | Documented defect; canonical KPI endpoint ready; flag-controlled switch | Low |
| R9 | Prisma in-memory stub diverges from real PostgreSQL semantics in tests | Low | Medium | Stub mirrors defaults/uniques used; Stage 2 runs the same reconciliation against real PostgreSQL | Low |
| R10 | Multi-currency postings arrive before translation reporting is approved | Low | Medium | Statements read base amounts only; foreign detail via currency filters; translation reports are a separately gated future workflow | Low |
