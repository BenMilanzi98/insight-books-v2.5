# Customer Onboarding Phase 21 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ratify PRD Phase 21 Customer Onboarding by forensically mapping mislabelled tree phase-17, quarantining Training/Adoption, and hardening the existing `CustomerOnboarding*` spine so Phase 20 handoff consumption, Project creation, readiness honesty, go-live/completion, CS handover, and Phase 22 Training handoff are trustworthy — without a second onboarding domain or Training delivery.

**Architecture:** Approach B waves. Approach 1 — extend `lib/admin/customerSuccess/onboarding/**` (tree phase-17 ≡ PRD 21). New docs under `docs/admin-intelligence-crm/phase-21/`. Training tree-18 = FUTURE PRD 22; Adoption tree-19 = FUTURE. Exit target `READY_FOR_PHASE_22_WITH_BLOCKERS`.

**Tech Stack:** Next.js App Router, Prisma (+ SQL fallbacks), Vitest, AdminShell, Phase 20 conversion handoffs, Phase 17 CRM Tasks/Meetings, Platform Customer/Tenant/Subscription/invitation boundaries, en/ny i18n.

**Spec:** [docs/superpowers/specs/2026-07-31-customer-onboarding-phase-21-design.md](../specs/2026-07-31-customer-onboarding-phase-21-design.md)  
**Prior design (alias):** [docs/superpowers/specs/2026-07-31-customer-onboarding-phase-17-design.md](../specs/2026-07-31-customer-onboarding-phase-17-design.md)

## Global Constraints

- PRD Phase 21 = Customer Onboarding; tree phase-17 code is canonical; do not create a parallel onboarding domain.
- Do not delete Training (tree-18 / PRD 22) or Adoption (tree-19); quarantine as FUTURE; Phase 21 does not absorb Training delivery.
- Handoff ≠ Request ≠ Project ≠ Training Program; request ≠ result; invitation ≠ access validated; go-live ≠ completion; completion ≠ adoption.
- Exact retries must not duplicate handoff accept, Project, workstreams, milestones, Training handoffs, go-live decisions, certificates, CS handovers.
- UNKNOWN ≠ READY/VALID; no fabricated provision/ACTIVATED/Training/test/go-live/completion.
- No Tenant GL / billing SoT / MRA fiscal; no secrets in notes/exports; gate fail → never false zero; System CoA stays removed.
- Portfolio/team/territory/tenant/business/branch fail-closed on list/search/export/metrics/writes-by-id.
- Commits only when user asks; WORKING_TREE OK; SQL + model guards if Prisma EPERM.
- Targeted harden only (Critical/High); optional polish remains WITH_BLOCKERS.

## File map

| Area | Paths |
|------|--------|
| Onboarding domain (harden) | `lib/admin/customerSuccess/onboarding/**` |
| Phase 20 handoff | `lib/admin/crm/conversions/onboardingHandoff.js` |
| Training (do not absorb) | `lib/admin/customerSuccess/training/**` — FUTURE PRD 22 |
| Adoption (quarantine) | `lib/admin/customerSuccess/adoption/**` |
| Prisma | Existing `CustomerOnboarding*` — extend only if gap requires |
| APIs / UI | `app/api/admin/customer-success/onboarding*/**`, `app/insightbooks/customer-success/onboarding/**` |
| Tests | `test/systemAdmin.cs.onboardingPhase21Wave{1..4}.test.js` (and/or extend existing onboardingWave*) |
| Wave 0 / exit docs | `docs/admin-intelligence-crm/phase-21/*` |
| SDD ledger | `.superpowers/sdd/progress-phase21.md` (`*-p21.md`) |

---

### Task 0: Wave 0 — Forensic audits, compatibility map, CONDITIONAL GO

**Files:** Create Wave 0 pack under `docs/admin-intelligence-crm/phase-21/` per master prompt §2 (README, PHASE_21_SCOPE, AUTHORITATIVE_ROADMAP_MAP, MISLABELLED_ONBOARDING_ARTIFACT_AUDIT, ONBOARDING_COMPATIBILITY_MAP, PHASE_INPUT_VALIDATION, CURRENT_* audits, DQ/privacy/security/performance, GAP_REGISTER, IMPLEMENTATION_PLAN). Banner Training/Adoption FUTURE. **No application code** except optional README banners.

**Interfaces:**
- Consumes: Phase 20 `PHASE_21_INPUTS.md`, `FINAL_READINESS_DECISION.md`, tree phase-17 docs/code, tree-18 Training, tree-19 Adoption
- Produces: CONDITIONAL GO / BLOCKED; compatibility classifications

- [ ] Validate Phase 20 exit READY_FOR_PHASE_21_WITH_BLOCKERS; map tree-17 ≡ PRD 21 with real paths
- [ ] Audit mislabelled onboarding under phase-17; Training/Adoption FUTURE
- [ ] Classify onboarding surfaces with real file paths; gap register → Waves 1–4
- [ ] Wave 0 readiness CONDITIONAL GO or BLOCKED
- [ ] Stop — user already chose Subagent-Driven; proceed Wave 1 after review gate

---

### Task 1: Wave 1 — Handoff validate/accept + Project spine harden

**Files:** Harden `handoffConsume.js`, `handover.js` (if CS handover distinct), `requests.js`, `projects.js`, `status.js`, templates materialise; test `test/systemAdmin.cs.onboardingPhase21Wave1.test.js`

**Interfaces / hardens:**
- Handoff checksum validation; UNKNOWN ≠ VALID
- `acceptOnboardingHandoff` idempotent; exact retry same
- Correction/supersession preserves history
- Project create after accept; ONB- numbering; template pin; one active Project; conflicting idempotency fails
- Invalid status transitions throw

- [ ] Write failing Vitest → implement → PASS Wave 1
- [ ] SDD review gate before Wave 2

---

### Task 2: Wave 2 — Readiness honesty + accounting boundary

**Files:** Harden provisioning/subscription/entitlement/user/access/config/migration readiness modules; accounting boundary helpers; test Wave 2

**Interfaces / hardens:**
- Request ≠ READY/ACTIVE/PROVISIONED without provider result
- Invitation sent ≠ ACCESS_VALID
- No fabricated Tenant/User IDs
- Migration coordinate/reconcile only; no unsafe browser import
- Accounting: governed services only; no balance edit / fake journal / CoA admin
- Portfolio fail-closed on readiness writes-by-id

- [ ] Write failing Vitest → implement → PASS Waves 1–2
- [ ] SDD review gate before Wave 3

---

### Task 3: Wave 3 — Go-live / completion / CS handover / Phase 22 Training handoff

**Files:** Harden `goLive.js`, `stabilisation.js`, `completion.js`, CS handover, `training.js` Phase 22 handoff; test Wave 3

**Interfaces / hardens:**
- Go-live readiness UNKNOWN ≠ READY; Critical/High defects block
- Decision SoD; execution ≠ schedule; rollback preserves evidence
- Completion requires go-live + stabilisation + acceptances + CS handover + recon (not go-live alone)
- Certificate checksum idempotent; COMPLETED_WITH_GAPS explicit
- Phase 22 Training handoff checksum/idempotent; never create Programs/Sessions/attendance/certs
- CS handover does not overwrite Customer Health

- [ ] Write failing Vitest → implement → PASS Waves 1–3
- [ ] SDD review gate before Wave 4

---

### Task 4: Wave 4 — UI/metrics/DQ/recon/Phase 22 pack/exit

**Files:** Metrics/reliabilityGate/search/exports/DQ/recon harden; thin UI as needed; docs PHASE_22_INPUTS + checklist + FINAL report; exit `READY_FOR_PHASE_22_WITH_BLOCKERS`; test Wave 4

**Interfaces / hardens:**
- Gate fail → UNAVAILABLE / value null
- Search/export/DQ/recon fail-closed scoped
- Progress ≠ readiness ≠ completion; completion ≠ adoption
- Phase 22 pack honest; mislabel map pointer
- Exit decision recorded

- [ ] Write failing Vitest → implement → PASS Waves 1–4
- [ ] SDD final whole-branch review before exit ratification

---

## Spec coverage

| Spec area | Tasks |
|-----------|-------|
| Compatibility / mislabel / quarantine | 0 |
| Handoff / Project spine | 1 |
| Readiness honesty / accounting | 2 |
| Go-live / completion / Training handoff | 3 |
| UI / metrics / Phase 22 pack / exit | 4 |

## Execution notes

- **BASE_SHA:** `7d9709a897bc0d4609ce8a6725aad7d9cf1cb835` (WORKING_TREE)
- Work in-place on `v2`
- Execution: Subagent-Driven (user confirmed)
- Do not start PRD Phase 22 Training re-home until Phase 21 exit ratified
