# Onboarding Compatibility Map — PRD 21 Customer Onboarding

**Audited:** 2026-07-31  
**Legend:** READY | PARTIAL | GAP | CORRECT_AND_REUSABLE | EXTEND | FOUNDATION | MISLABELLED_PHASE | FUTURE_PHASE_SCOPE | NON_AUTHORITATIVE | NOT_FOUND | FORBIDDEN

## Domain surfaces

| Surface | Path(s) | Status | Class | Notes |
|---------|---------|--------|-------|-------|
| Domain contract / catalogue | `catalogue.js` (`phase` still tree-17) | PARTIAL | EXTEND | Honesty flags good; bump PRD phase label Wave 4 |
| Handoff consume | `handoffConsume.js` | PARTIAL | EXTEND | Idempotent Request create; **no** `acceptOnboardingHandoff` + checksum validate yet |
| Phase 20 handoff emit | `lib/admin/crm/conversions/onboardingHandoff.js`, `handoffShared.js` | READY | CORRECT_AND_REUSABLE | Checksum + one-active + supersession; handoff ≠ Project |
| Request spine | `requests.js`, Prisma `CustomerOnboardingRequest` | READY | CORRECT_AND_REUSABLE / EXTEND | ONR numbering + status machine; deepen accept path |
| Project spine | `projects.js`, Prisma `CustomerOnboardingProject` | PARTIAL | EXTEND | ONB- + template pin + idempotency; harden one-active / conflicting keys |
| Status machines | `status.js` | PARTIAL | EXTEND | Invalid transitions throw; deepen DRAFT→COMPLETED forbid edges |
| Templates / versions | `templates.js`, `templateVersions.js` | PARTIAL | EXTEND | ACTIVE immutable pattern; pin required on Project |
| Materialisation | `materialise.js` | PARTIAL | EXTEND | Workstreams/milestones/checklists/tasks once |
| Workstreams / milestones / checklists / tasks | `workstreams.js`, `milestones.js`, tasks models, `tasks.js` | PARTIAL | EXTEND | Evidence + SoD present; deepen |
| Kick-off | `kickoff.js` | PARTIAL | EXTEND | Phase 13 Meeting; RSVP ≠ attendance; fail closed |
| Requirements / scope / CR | `requirements.js`, `scope.js`, `changeRequests.js` | PARTIAL | EXTEND | Never silent entitlement mutate |
| Tenant readiness | `readiness/tenant.js` | PARTIAL | EXTEND | UNKNOWN when model unavailable |
| Business/branch readiness | `readiness/businessBranch.js` | PARTIAL | EXTEND | Pin honesty |
| User/access readiness | `readiness/users.js` | PARTIAL | EXTEND | Invitation ≠ ACCESS_VALID deepen |
| Config / accounting readiness | `readiness/configuration.js`, `readiness/accounting.js`, `accountingBoundary.js` | PARTIAL | EXTEND | No Tenant GL; subscription pin ≠ ACTIVE fabricate |
| Dedicated provisioning readiness | — | GAP | PARTIAL / NOT_FOUND module | Covered thinly via tenant pins; Wave 2 |
| Dedicated subscription/entitlement readiness | — | GAP | PARTIAL | Via configuration; Wave 2 honesty |
| Aggregate readiness | `readiness/evaluate.js` | PARTIAL | EXTEND | UNKNOWN ≠ READY; blocks go-live |
| Migration coordination | `migration.js` | PARTIAL | EXTEND | Engine NOT_AVAILABLE; recon gate |
| Training coordination | `training.js` | PARTIAL | EXTEND | COMPLETED requires Training-domain source |
| Phase 22 Training handoff package | — | GAP | NOT_FOUND | Wave 3 — checksum/idempotent emit |
| MRA EIS coordination | `mraEis.js` | PARTIAL | EXTEND | No fiscal/credentials |
| Integration coordination | — | GAP | NOT_FOUND | Wave 2–3 metadata readiness |
| Testing / defects | `testing.js`, `defects.js` | PARTIAL | EXTEND | Critical blocks go-live |
| Cutover | — | GAP | NOT_FOUND dedicated | Wave 3 coordinate with go-live |
| Go-live | `goLive.js` | PARTIAL | EXTEND | UNKNOWN blocks; SoD deepen |
| Stabilisation | `stabilisation.js` | PARTIAL | EXTEND | Distinct from hypercare |
| Completion / certificate | `completion.js` | PARTIAL | EXTEND | Checksum idempotent; go-live ≠ completion |
| CS handover | `handover.js` | PARTIAL | EXTEND | Idempotent; must not overwrite Customer Health |
| Metrics / reliability | `metrics.js`, `reliabilityGate.js` | PARTIAL | EXTEND | Gate fail → UNAVAILABLE / null |
| DQ / recon / lineage | `dataQuality.js`, `reconciliation.js`, `lineage.js` | PARTIAL | EXTEND | Deepen fail-closed |
| Reports / exports / search | `reports.js`, `exports.js`, `search.js` | PARTIAL | EXTEND | Credential strip; scope harden |
| UI hubs | `app/insightbooks/customer-success/onboarding/**` | PARTIAL | FOUNDATION | Present; polish Wave 4 |
| APIs | `app/api/admin/customer-success/onboarding*/**` | PARTIAL | FOUNDATION | Present |
| Training domain Programs | `lib/admin/customerSuccess/training/**` | N/A | FUTURE_PHASE_SCOPE | Do not absorb |
| Adoption Plans | `lib/admin/customerSuccess/adoption/**` | N/A | FUTURE_PHASE_SCOPE | Quarantine |
| Fabricate COMPLETED/ACTIVE/PROVISIONED | — | — | FORBIDDEN | Never |

## Compatibility classifications (rollup)

| Upstream / peer | Class for PRD 21 |
|-----------------|------------------|
| Phase 20 onboarding handoff + checksum | CORRECT_AND_REUSABLE |
| Tree phase-17 onboarding spine + Vitest Waves 1–4 | CORRECT_AND_REUSABLE / EXTEND |
| Tree phase-18 Training | FUTURE_PHASE_SCOPE (handoff target) |
| Tree phase-19 Adoption | FUTURE_PHASE_SCOPE |
| Phase 8 CsOnboardingRecord | REUSE_WITH_RECONCILIATION |
| Parallel second onboarding domain | FORBIDDEN |
| Training delivery from Phase 21 | FORBIDDEN |

## Implication

Wave 0 finds a **real, durable onboarding spine** already implemented under the tree-17 name. Phase 21 is **harden + re-home docs**, not greenfield. Critical/High gaps cluster around handoff **accept + checksum validate**, dedicated readiness honesty (provision/subscription/entitlement), cutover + Phase 22 Training handoff package, and fail-closed portfolio polish.
