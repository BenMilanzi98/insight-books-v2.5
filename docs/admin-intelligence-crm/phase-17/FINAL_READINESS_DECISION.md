# Final Readiness Decision — Exit Phase 17 / Enter Phase 18

**Decision:** **READY_FOR_PHASE_18_WITH_BLOCKERS**

**Date:** 2026-07-31

## Rationale

Phase 17 Waves 0–4 deliver a trustworthy Customer Onboarding plane:

1. **Wave 0** forensic pack + CONDITIONAL GO validated Phase 16 inputs.
2. **Waves 1–3** deliver durable Request/Project saga, templates/materialisation, kick-off binding, readiness, go-live → stabilisation → handover → checksum certificate, with honesty boundaries (UNKNOWN ≠ READY; progress ≠ completion; no Tenant GL; no fabricated Training/migration complete).
3. **Wave 4** delivers Overview/My Work/queues/Context Bar UI, reliability-gated metrics (gate fail → UNAVAILABLE / `value: null`), DQ/recon/lineage, report catalogue + credential-stripped exports, Phase 8 `CsOnboardingRecord` link (or UNKNOWN — never invent COMPLETED), EN+NY hub keys, and Phase 18 input pack.
4. Vitest Waves 1–4 green (WORKING_TREE; **50/50** after final-review fix wave). Exit docs written.
5. Final whole-branch review Criticals (list authz C1; completion requireGoLive C2) and Important I1–I5 fixed — see `.superpowers/sdd/phase17-final-review.md` post-fix verification: `READY_WORKING_TREE_WITH_BLOCKERS`.

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
