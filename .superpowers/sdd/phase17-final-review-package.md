# Phase 17 final review package
BASE: 7d9709a897bc0d4609ce8a6725aad7d9cf1cb835
HEAD: WORKING_TREE

- lib/admin/customerSuccess/onboarding/accountingBoundary.js (4461)
- lib/admin/customerSuccess/onboarding/cache.js (1068)
- lib/admin/customerSuccess/onboarding/catalogue.js (5331)
- lib/admin/customerSuccess/onboarding/changeRequests.js (1909)
- lib/admin/customerSuccess/onboarding/completion.js (7780)
- lib/admin/customerSuccess/onboarding/dataQuality.js (2412)
- lib/admin/customerSuccess/onboarding/defects.js (2157)
- lib/admin/customerSuccess/onboarding/dependencies.js (3886)
- lib/admin/customerSuccess/onboarding/evidence.js (4622)
- lib/admin/customerSuccess/onboarding/exports.js (3589)
- lib/admin/customerSuccess/onboarding/goLive.js (12416)
- lib/admin/customerSuccess/onboarding/handoffConsume.js (6068)
- lib/admin/customerSuccess/onboarding/handover.js (3747)
- lib/admin/customerSuccess/onboarding/health.js (2120)
- lib/admin/customerSuccess/onboarding/hubKeys.js (1168)
- lib/admin/customerSuccess/onboarding/index.js (8707)
- lib/admin/customerSuccess/onboarding/kickoff.js (7870)
- lib/admin/customerSuccess/onboarding/lineage.js (1964)
- lib/admin/customerSuccess/onboarding/materialise.js (8695)
- lib/admin/customerSuccess/onboarding/metrics.js (6266)
- lib/admin/customerSuccess/onboarding/migration.js (3209)
- lib/admin/customerSuccess/onboarding/milestones.js (1111)
- lib/admin/customerSuccess/onboarding/model.js (16665)
- lib/admin/customerSuccess/onboarding/mraEis.js (2486)
- lib/admin/customerSuccess/onboarding/myWork.js (2765)
- lib/admin/customerSuccess/onboarding/notifications.js (701)
- lib/admin/customerSuccess/onboarding/numbering.js (841)
- lib/admin/customerSuccess/onboarding/phase8Migrate.js (3466)
- lib/admin/customerSuccess/onboarding/progress.js (2782)
- lib/admin/customerSuccess/onboarding/projectAccess.js (2169)
- lib/admin/customerSuccess/onboarding/projects.js (10927)
- lib/admin/customerSuccess/onboarding/reconciliation.js (2199)
- lib/admin/customerSuccess/onboarding/reliabilityGate.js (2303)
- lib/admin/customerSuccess/onboarding/reports.js (2957)
- lib/admin/customerSuccess/onboarding/requests.js (10061)
- lib/admin/customerSuccess/onboarding/requirements.js (2500)
- lib/admin/customerSuccess/onboarding/responsibilities.js (1971)
- lib/admin/customerSuccess/onboarding/scope.js (3758)
- lib/admin/customerSuccess/onboarding/search.js (4941)
- lib/admin/customerSuccess/onboarding/stabilisation.js (3895)
- lib/admin/customerSuccess/onboarding/stakeholders.js (3869)
- lib/admin/customerSuccess/onboarding/status.js (10240)
- lib/admin/customerSuccess/onboarding/tasks.js (4938)
- lib/admin/customerSuccess/onboarding/templates.js (2306)
- lib/admin/customerSuccess/onboarding/templateVersions.js (5211)
- lib/admin/customerSuccess/onboarding/testing.js (1922)
- lib/admin/customerSuccess/onboarding/training.js (3186)
- lib/admin/customerSuccess/onboarding/workstreams.js (1121)
- lib/admin/customerSuccess/onboarding/readiness/accounting.js (1226)
- lib/admin/customerSuccess/onboarding/readiness/businessBranch.js (1720)
- lib/admin/customerSuccess/onboarding/readiness/configuration.js (1290)
- lib/admin/customerSuccess/onboarding/readiness/evaluate.js (10414)
- lib/admin/customerSuccess/onboarding/readiness/tenant.js (1388)
- lib/admin/customerSuccess/onboarding/readiness/users.js (900)
- scripts/sql/cs-onboarding-phase17-wave1.sql
- scripts/sql/cs-onboarding-phase17-wave2.sql
- scripts/sql/cs-onboarding-phase17-wave3.sql
- scripts/sql/cs-onboarding-phase17-wave4.sql
- test/systemAdmin.cs.onboardingWave1.test.js
- test/systemAdmin.cs.onboardingWave2.test.js
- test/systemAdmin.cs.onboardingWave3.test.js
- test/systemAdmin.cs.onboardingWave4.test.js

## Exit

# Final Readiness Decision — Exit Phase 17 / Enter Phase 18

**Decision:** **READY_FOR_PHASE_18_WITH_BLOCKERS**

**Date:** 2026-07-31

## Rationale

Phase 17 Waves 0–4 deliver a trustworthy Customer Onboarding plane:

1. **Wave 0** forensic pack + CONDITIONAL GO validated Phase 16 inputs.
2. **Waves 1–3** deliver durable Request/Project saga, templates/materialisation, kick-off binding, readiness, go-live → stabilisation → handover → checksum certificate, with honesty boundaries (UNKNOWN ≠ READY; progress ≠ completion; no Tenant GL; no fabricated Training/migration complete).
3. **Wave 4** delivers Overview/My Work/queues/Context Bar UI, reliability-gated metrics (gate fail → UNAVAILABLE / `value: null`), DQ/recon/lineage, report catalogue + credential-stripped exports, Phase 8 `CsOnboardingRecord` link (or UNKNOWN — never invent COMPLETED), EN+NY hub keys, and Phase 18 input pack.
4. Vitest Waves 1–4 green (WORKING_TREE). Exit docs written.

## Conditions for Phase 18

1. Consume onboarding training coordination into Training domain without fabricating COMPLETED/DELIVERED/PASSED/CERTIFIED from onboarding alone.
2. Never invent KPI zeroes on reliability gate failure.
3. Never treat Phase 8 historical checklist COMPLETED as Project COMPLETED without linked Project evidence.
4. Preserve accounting boundary, portal typed-unavailable, migration recon gate, certificate checksum idempotency.
5. Treat portal / migration engine / MRA fiscal / payment/e-sign as explicit blockers until configured.

## Wave / pack completion

- [x] Phase input validation PASS (Wave 0)
- [x] CURRENT_* + ONBOARDING_* audits + matrices
- [x] Gap register + IMPLEMENTATION_PLAN Waves 1–4
- [x] Wave 1 application code
- [x] Wave 2 application code
- [x] Wave 3 application code
- [x] Wave 4 application code + Phase 18 pack
- [x] **READY_FOR_PHASE_18_WITH_BLOCKERS** recorded

**Next:** Phase 18 may consume training coordination / onboarding certificates / reports under documented blockers.

**Stop:** Do not fabricate Training complete from onboarding coordination; do not invent KPI zeroes on gate fail; do not invent Project COMPLETED from Phase 8 historical rows; do not post Tenant GL from onboarding.

## Minor carry from task reviews
- Wave2 template SoD soft only
- Thin UI without live card fetch
- Prisma EPERM ? SQL fallback

