# Phase 21 Gap Register

**Audited:** 2026-07-31  
**Inputs:** Wave 0 CURRENT_* audits, compatibility map, design/plan, Phase 20 `PHASE_21_INPUTS.md`, tree phase-17 spine

| ID | Gap | Severity | Wave | Notes |
|----|-----|----------|------|-------|
| G21-01 | No `acceptOnboardingHandoff` with checksum validate; UNKNOWN ≠ VALID | CRITICAL | 1 | Emit has `computeOnboardingHandoffChecksum`; consume skips validate |
| G21-02 | Handoff accept idempotency / exact retry same; conflicting key fails | CRITICAL | 1 | Deepen beyond Request create idempotency |
| G21-03 | Correction/supersession preserves history on accept path | HIGH | 1 | Align with Phase 20 one-active handoff |
| G21-04 | Project create after accept; one active Project; conflicting idempotency fails | CRITICAL | 1 | `projects.js` present — harden edges |
| G21-05 | Invalid status transitions (DRAFT→COMPLETED, PLANNING→go-live complete) throw | HIGH | 1 | `status.js` EXTEND |
| G21-06 | Template pin required; ACTIVE immutable; materialise once | HIGH | 1–2 | Present — prove + harden |
| G21-07 | Provisioning readiness: REQUESTED/PROCESSING ≠ READY; no fabricated Tenant IDs | CRITICAL | 2 | Dedicated module thin/absent |
| G21-08 | Subscription readiness: ACTIVE only from authoritative service | CRITICAL | 2 | Via configuration pin today |
| G21-09 | Entitlement readiness: no unaccepted scope / UI term mutation | CRITICAL | 2 | CR path exists; deepen |
| G21-10 | Invitation sent ≠ ACCESS_VALID; no Platform Super Admin via onboarding | CRITICAL | 2 | `readiness/users.js` |
| G21-11 | Business/branch readiness fail-closed on writes-by-id | HIGH | 2 | `readiness/businessBranch.js` |
| G21-12 | Config readiness evidence-based; accounting via governed services only | HIGH | 2 | `accountingBoundary.js` EXTEND |
| G21-13 | Migration coordinate/reconcile only; no unsafe browser import | HIGH | 2–3 | `migration.js` |
| G21-14 | Integration coordination metadata + secrets redacted | HIGH | 2–3 | NOT_FOUND module |
| G21-15 | Go-live readiness UNKNOWN ≠ READY; Critical/High defects block | CRITICAL | 3 | `goLive.js` / `evaluate.js` present — harden |
| G21-16 | Go-live decision SoD; execution ≠ schedule; rollback preserves evidence | HIGH | 3 | Deepen approvals |
| G21-17 | Cutover coordination distinct from go-live success | HIGH | 3 | NOT_FOUND dedicated |
| G21-18 | Completion requires go-live + stabilisation + acceptances + CS handover + recon | CRITICAL | 3 | `completion.js` present — prove gaps |
| G21-19 | Certificate checksum idempotent; COMPLETED_WITH_GAPS explicit | HIGH | 3 | Present — harden |
| G21-20 | CS handover checksum/idempotent; does not overwrite Customer Health | HIGH | 3 | `handover.js` |
| G21-21 | Phase 22 Training handoff package checksum/idempotent; never create Programs | CRITICAL | 3 | NOT_FOUND — `training.js` is coord only |
| G21-22 | Training coordination COMPLETED still requires Training-domain source | HIGH | 3 | Preserve `training.js` gate |
| G21-23 | Reliability gate never false zero; scopes fail-closed | HIGH | 4 | `reliabilityGate.js` / `listScope.js` |
| G21-24 | Search/export/DQ/recon fail-closed + PII projection | HIGH | 4 | Present — deepen |
| G21-25 | Progress ≠ readiness ≠ completion; completion ≠ adoption | HIGH | 4 | Labels + metrics honesty |
| G21-26 | Domain contract / hub keys PRD phase 21 label | MEDIUM | 4 | Still tree-17 labels |
| G21-27 | Phase 22 input pack + FINAL report + exit WITH_BLOCKERS | HIGH | 4 | `PHASE_22_INPUTS.md` |
| G21-28 | Vitest Phase 21 Waves 1–4 | HIGH | 1–4 | New or extend onboardingWave* |
| G21-29 | Payment / e-sign providers | CARRY | — | NOT_CONFIGURED from Phase 20 |
| G21-30 | Customer portal evidence | CARRY | — | CUSTOMER_PORTAL_NOT_CONFIGURED |
| G21-31 | Migration engine / MRA fiscal / Training delivery | CARRY | — | NOT_AVAILABLE / FUTURE PRD 22 |
| G21-32 | Prisma EPERM Windows | CARRY | All | SQL + has*Model guards |
| G21-33 | Parallel onboarding domain / absorb Training/Adoption | FORBIDDEN | — | Never |
| G21-34 | Fabricate COMPLETED/ACTIVE/PROVISIONED/Training/go-live | FORBIDDEN | — | Never |
| G21-35 | Tenant GL / invent zeroes / secrets in exports | FORBIDDEN | — | Preserve |

**Wave 0 blocker count for CONDITIONAL GO:** **0** Critical identity/domain blockers. Critical harden items are scheduled Waves 1–3 (expected).

**No TBD blocking Wave 1 after CONDITIONAL GO** — onboarding spine CORRECT_AND_REUSABLE; Phase 20 exit READY_FOR_PHASE_21_WITH_BLOCKERS; Wave 1 is targeted handoff accept + Project spine harden + Vitest.
