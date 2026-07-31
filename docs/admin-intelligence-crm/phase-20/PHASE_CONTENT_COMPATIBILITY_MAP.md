# Phase Content Compatibility Map — PRD 20 Lead Conversion

**Audited:** 2026-07-31  
**Legend:** READY | PARTIAL | GAP | CORRECT_AND_REUSABLE | EXTEND | FOUNDATION | MISLABELLED_PHASE | FUTURE_PHASE_SCOPE | NON_AUTHORITATIVE | NOT_FOUND | FORBIDDEN

## Domain surfaces

| Surface | Path(s) | Status | Class | Notes |
|---------|---------|--------|-------|-------|
| Conversion orchestrator | `lib/admin/crm/conversions/orchestrator.js` | PARTIAL | EXTEND | Exact retry + resume present; harden conflicting hashes / readiness gates |
| Conversion catalogue / contract | `catalogue.js` (`phase: 16`) | PARTIAL | EXTEND | Bump phase label Wave 4; honesty flags good |
| Request spine | `requests.js`, Prisma `CrmConversionRequest` | READY | CORRECT_AND_REUSABLE | CVR numbering + status machine |
| Readiness (conversion wrap) | `readiness.js` | PARTIAL | EXTEND | Soft-allows missing acceptance; UNKNOWN status not in enum |
| Closed-Won commercial readiness | `lib/admin/crm/commercial/readiness.js` | PARTIAL | EXTEND | Version/checksum/authority; expired/superseded version check weak |
| Opp close | `lib/admin/crm/opportunities/close.js` | READY | CORRECT_AND_REUSABLE | `assertNoProvision`; no side effects on close alone |
| Opp conversion readiness | `opportunities/conversionReadiness.js` | READY | CORRECT_AND_REUSABLE | Soft checklist; never provisions |
| Steps / idempotency | `steps.js` | PARTIAL | EXTEND | Wave1–4 steps; deepen snapshot lock + concurrency |
| Customer match | `customerMatch.js` | PARTIAL | EXTEND | No auto-merge; POSSIBLE blocks; EXACT_MATCH policy harden Wave 2 |
| Customer provision | `customerProvision.js` | PARTIAL | EXTEND | Create/link audited |
| Contact link | `businessBranch.js` `linkContactsForConversion` | PARTIAL | EXTEND | Cross-Customer deny + consent harden |
| Tenant / branch | `tenantProvision.js`, `businessBranch.js` | PARTIAL | EXTEND | Isolation assert; reserved slugs |
| Subscription / entitlements | `subscription.js`, `entitlements.js` | PARTIAL | EXTEND | Snapshot-driven; Closed Won ≠ ACTIVE |
| Billing / payment / activation | `billing.js`, `paymentBoundary.js`, `activation.js` | PARTIAL | EXTEND | Initiation ≠ PAID; AFTER_PAYMENT fail-closed |
| Onboarding handoff | `onboardingHandoff.js`, `handoffShared.js` | PARTIAL | EXTEND | Idempotent; forces `onboardingCompleted: false`; supersession/one-active deepen Wave 3 |
| Training/Migration/MRA handoffs | `*Handoff.js` | READY | CORRECT_AND_REUSABLE | Handoff ≠ execute |
| Completion certificate | `completion.js` | READY | CORRECT_AND_REUSABLE | Checksum; never deletes acceptance |
| Reports / metrics / gate | `reports.js`, `metrics.js`, `reliabilityGate.js` | PARTIAL | EXTEND | Gate → null/UNAVAILABLE; scope stub CARRY |
| DQ / recon | `dataQuality.js`, `reconciliation.js` | PARTIAL | EXTEND | Present; deepen Wave 4 |
| Exports module | — | GAP | NOT_FOUND | No `exports.js` under conversions — Wave 4 |
| Thin UI hubs | `app/insightbooks/crm/conversions/**` | PARTIAL | FOUNDATION | Overview/my-work/queues/requests/duplicate-review |
| Conversion APIs | `app/api/admin/crm/conversions/**` | PARTIAL | FOUNDATION | List + duplicate-review; expand as needed |
| Closed-won UI aliases | `/crm/closed-won/*` | GAP | NOT_FOUND | Optional thin aliases Wave 4 |
| CS Onboarding Project create from conversion | — | FORBIDDEN | FUTURE_PHASE_SCOPE | Must remain false in Phase 20 |
| Adoption PHASE_20_INPUTS | `phase-19/PHASE_20_INPUTS.md` | N/A | NON_AUTHORITATIVE | CS renewals |

## Compatibility classifications (rollup)

| Upstream / peer | Class for PRD 20 |
|-----------------|------------------|
| Tree phase-16 conversion exit + code | CORRECT_AND_REUSABLE / EXTEND |
| Tree phase-15 commercial acceptance/approvals | CORRECT_AND_REUSABLE / EXTEND |
| Pipeline closeOpportunityWon | CORRECT_AND_REUSABLE |
| Tree phase-17 CS onboarding | FUTURE_PHASE_SCOPE (consumer of handoff later) |
| Tree phase-18/19 CS training/adoption | FUTURE_PHASE_SCOPE / MISLABELLED_PHASE |
| Tenant Quotation / Tenant AR as conversion truth | WRONG_DOMAIN / FORBIDDEN |
| Fabricate PAID/ACTIVE/onboarding complete | FORBIDDEN |

## Implication

Wave 0 finds a **real, durable conversion spine** already implemented under the tree-16 name. Phase 20 is **harden + re-home docs**, not greenfield. Critical/High gaps cluster around readiness honesty (expired/UNKNOWN), snapshot immutability, duplicate EXACT_MATCH policy, request≠result edges, handoff one-active/supersede, exports, and fail-closed portfolio scope.
