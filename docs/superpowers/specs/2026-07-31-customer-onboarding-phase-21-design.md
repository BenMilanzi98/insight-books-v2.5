# Customer Onboarding Phase 21 — Design

**Status:** Approved (user review 2026-07-31)  
**Date:** 2026-07-31  
**Authoritative scope:** PRD Phase 21 — Customer Onboarding Management  
**Surface:** `/insightbooks/customer-success/onboarding` (+ overview, my-work, team, portfolio, calendar, queues, handoffs, projects, templates, go-live, stabilisation, completion, reports, settings; thin extensions on conversion / CS customer / intelligence deep-links)  
**Architecture:** Approach 1 — extend existing `CustomerOnboarding*` + `lib/admin/customerSuccess/onboarding/**` (tree phase-17); no parallel onboarding domain  
**Code alias:** Tree `docs/admin-intelligence-crm/phase-17/` Customer Onboarding ≡ this PRD Phase 21  
**Docs home:** `docs/admin-intelligence-crm/phase-21/` (forensic + compatibility + Phase 22 pack)  
**Upstream exit:** Phase 20 `READY_FOR_PHASE_21_WITH_BLOCKERS` (`docs/admin-intelligence-crm/phase-20/PHASE_21_INPUTS.md`)

---

## 1. Purpose

Harden and ratify one authoritative, evidence-based Customer Onboarding plane that consumes Phase 20 onboarding handoffs and manages Projects from handoff acceptance through kick-off, workstreams/milestones, readiness coordination, testing, cutover, go-live, stabilisation, completion, Customer Success handover, and Phase 22 Training handoff — without fabricating readiness/results, duplicating domains, absorbing Training delivery, silently changing commercial scope, or posting unauthorised Tenant accounting.

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Existing onboarding vs new domain | **A** — harden tree-17 `CustomerOnboarding*`; no second domain |
| Docs / quarantine | **A** — new `phase-21/` pack; Training tree-18 = FUTURE PRD 22; Adoption tree-19 = FUTURE; no renames/deletes |
| Gap depth | **A** — forensic + Critical/High truth/security harden only |
| Training | **A** — coordination + Phase 22 Training handoff only; never create Programs/Sessions/attendance/certs |
| Architecture | **Approach 1** — extend `lib/admin/customerSuccess/onboarding/**` |
| Sequencing | **Approach B** waves + SDD |
| Exit | Expect **`READY_FOR_PHASE_22_WITH_BLOCKERS`** when optional providers remain explicit |
| Commits | Only when user asks; WORKING_TREE OK; SQL + model guards if Prisma EPERM |

---

## 3. Phase-label correction (authoritative)

| PRD phase | Authoritative content | Tree folder (current) | Action |
|-----------|----------------------|------------------------|--------|
| 20 | Lead Conversion / Closed-Won | Tree phase-16 (+ phase-20 docs) | Consume handoffs |
| **21** | **Customer Onboarding** | Tree **phase-17** | **This phase — harden + re-home docs to phase-21/** |
| 22 | Customer Training | Tree **phase-18** | FUTURE — handoff target only |
| 23+ | Marketing / Adoption / … | Tree phase-19 Adoption = FUTURE CS | Quarantine |

**Do not** delete working onboarding/training/adoption code. **Do not** let Training or Adoption redefine Phase 21.

Prior design (alias): `docs/superpowers/specs/2026-07-31-customer-onboarding-phase-17-design.md`.

---

## 4. Hard rules

- Phase 20 Handoff ≠ Onboarding Request ≠ Onboarding Project ≠ Training Program.
- Provisioning request ≠ result; Subscription request ≠ ACTIVE; invitation sent ≠ access validated; login ≠ correct role access.
- Migration scope ≠ migration completion; Training requirement ≠ Training completion; test execution ≠ pass; scheduled go-live ≠ successful go-live; go-live ≠ onboarding completion; completion ≠ adoption.
- Exact retries must not duplicate handoff acceptances, Projects, workstreams, milestones, Training handoffs, go-live decisions, completion certificates, or CS handovers.
- UNKNOWN readiness/validation ≠ READY/VALID.
- No fabricated handoff accept, Project, provision, Subscription/entitlement ACTIVE, User, migration, Training, test pass, go-live, Customer acceptance, or completion.
- No silent commercial-scope expansion; material changes → governed change request / commercial amendment.
- No Tenant GL balance edits / fake journals / opening stock twice / Owner Capital duplicate; use governed accounting services; System CoA stays removed.
- No MRA EIS fiscal submission; no secrets in notes/exports; gate fail → never false zero.
- Portfolio / team / territory / tenant / business / branch fail-closed on list/search/export/metrics/writes-by-id.

---

## 5. Domain architecture

```text
Phase 20 Onboarding Handoff (checksum)
        ↓ validate / accept (idempotent)
CustomerOnboardingRequest (if used) → CustomerOnboardingProject (ONB-)
        ├── Template version (pinned)
        ├── Workstreams / Milestones / Checklists / Tasks (Phase 17 Activities)
        ├── Kick-off / Requirements / Owners / Contacts
        ├── Readiness: provisioning / subscription / entitlement / business / branch / user / access / config
        ├── Migration / Training / MRA EIS / Integration coordination
        ├── Testing / Defects / Cutover
        ├── Go-Live readiness → decision → execution → stabilisation
        ├── Completion + certificate
        ├── Customer Success handover
        └── Phase 22 Training handoff (checksum, idempotent)
```

**Canonical path:** `lib/admin/customerSuccess/onboarding/**`

**Reuse:** Phase 20 `onboardingHandoff.js`; Phase 17 CRM Tasks/Meetings/Calendar; Platform Customer/Tenant/Subscription/entitlement/invitation services; Phase 8 foundations where linked.

**Do not duplicate:** Conversion domain; Training Programs (tree-18); Adoption Plans (tree-19); Support Tickets; Platform Incidents; Product-event warehouse; Customer Health engine.

---

## 6. Handoff validation & acceptance

Validate: handoff identity, Conversion, Customer, commercial snapshot + checksum, Products/plan/add-ons/quantities/currency, contacts, businesses/branches, user/training/migration/MRA/integration requirements, watermarks, DQ/recon, permission scope.

States include `VALID`, `VALID_WITH_WARNINGS`, `CORRECTION_REQUIRED`, `RECONCILIATION_FAILED`, `UNKNOWN`, … — **UNKNOWN never VALID**.

`acceptOnboardingHandoff({ actorContext, handoffId, expectedVersion, acceptanceNotes, idempotencyKey })` — authorise, validate checksum, no duplicate active Project, record acceptance, emit events. Exact retry → same result. Acceptance does not prove provision/activation/Training/go-live.

---

## 7. Project spine

Numbering `ONB-YYYY-######`. Create after handoff accept with pinned `templateVersionId`, owner assignments, target dates. Materialise workstreams/milestones/checklists once. Status machine forbids DRAFT→COMPLETED, PLANNING→go-live complete, COMPLETED without review. Types: NEW_CUSTOMER, NEW_TENANT, EXPANSION, MRA_EIS_ENABLEMENT, DATA_MIGRATION, etc.

Templates: versioned; ACTIVE immutable; historical Projects retain exact version.

---

## 8. Readiness honesty

| Area | Rule |
|------|------|
| Provisioning | REQUESTED/PROCESSING ≠ READY; no fabricated Tenant/Business/Branch IDs |
| Subscription / entitlements | ACTIVE only from authoritative service; no UI term mutation; no unaccepted scope |
| Users / access | Invitation sent ≠ ACCESS_VALID; least privilege; no Platform Super Admin via onboarding; no shared passwords |
| Configuration | Evidence-based; accounting via governed CoA/period/OB/stock services |
| Migration | Coordinate/consume import results; reconcile counts/totals; no unsafe browser import engine |
| MRA EIS / integrations | Metadata + readiness only; secrets redacted; no fiscal submit |

---

## 9. Go-live, stabilisation, completion, CS handover

**Go-live readiness:** server-authoritative dimensions (handoff, owners, kick-off, requirements, provision, subscription, entitlements, businesses/branches, users/access, config, migration, Training policy, MRA/integrations, tests, Critical/High defects, cutover+rollback, approvals, recon/DQ). UNKNOWN ≠ READY.

**Decision:** GO / GO_WITH_CONDITIONS / NO_GO / DEFERRED / CANCELLED with SoD. Execution ≠ schedule alone; rollback preserves evidence.

**Stabilisation:** short-term early-life; distinct from Phase 35 hypercare.

**Completion:** workstreams/milestones/checklists/tests/migration/Training policy/MRA/integrations/go-live/stabilisation/Customer+internal acceptance/CS handover/recon. Go-live ≠ completion. COMPLETED_WITH_GAPS explicit. Certificate checksum idempotent.

**CS handover:** identity, commercial, implementation, users, Training, migration, product, support/technical, success criteria, open gaps — checksum/idempotent; does not auto-alter Customer Health.

---

## 10. Phase 22 Training handoff

One package: Project/Customer/Tenant/Subscription, products/modules/roles, participants, contacts, language/delivery, dates, go-live dependency, commercial inclusion, risks, watermark, checksum, idempotency.

States: DRAFT → READY → SENT → ACCEPTED_BY_TRAINING / CORRECTION_REQUIRED / SUPERSEDED / …

Phase 21 must not create Trainers, Sessions, attendance, assessments, certificates. Consume Phase 22 outcomes when available; gaps remain explicit.

---

## 11. UI, permissions, privacy

Canonical routes under `/insightbooks/customer-success/onboarding`. No competing implementation route families.

Permissions: extend existing `systemAdmin.customerSuccess.onboarding*` catalogue as needed. Field projections for Implementation Manager, CSM, Technical, Migration, Training coordinator, MRA specialist, Finance, Customer Project Owner, Executive, Auditor.

SoD: template author≠approver; milestone completer≠verifier; migration op≠recon reviewer; go-live evaluator≠approver; executor≠completion approver.

Exports: PDF/XLSX/CSV/ICS with revalidated permission, PII projection, no credentials/migration secrets, formula injection neutralised, en + ny.

---

## 12. Waves (SDD)

| Wave | Deliverable |
|------|-------------|
| 0 | `docs/admin-intelligence-crm/phase-21/` forensic pack: roadmap map, mislabel audit, compatibility map, CURRENT_* audits, gap register, IMPLEMENTATION_PLAN, PHASE_INPUT_VALIDATION → CONDITIONAL GO. Banner Training/Adoption FUTURE. **No Wave 1 code until GO + execution mode.** |
| 1 | Handoff validate/accept/correct + Project create/idempotency/status harden |
| 2 | Readiness honesty (provision/subscription/access/config/migration) + accounting boundary |
| 3 | Go-live/stabilisation/completion/CS handover + Phase 22 Training handoff |
| 4 | UI hubs/metrics/reliability/DQ/recon/exports + Phase 22 pack + exit |

**Tests:** `test/systemAdmin.cs.onboardingPhase21Wave{1..4}.test.js` (extend existing onboardingWave* tests with Phase 21 gap cases).  
**SDD ledger:** `.superpowers/sdd/progress-phase21.md` (`*-p21.md` briefs).

---

## 13. Exit criteria

**Target:** `READY_FOR_PHASE_22_WITH_BLOCKERS`

Must be true:
- Compatibility map documents PRD ↔ tree numbering; Training/Adoption quarantined
- One canonical onboarding domain
- Handoff checksum/accept idempotent; Project create idempotent
- Request≠result readiness honesty
- Go-live/completion evidence-based; UNKNOWN ≠ READY
- Phase 22 Training handoff complete (no Training delivery)
- Reliability gate never false zero; scopes fail-closed
- Vitest Waves 1–4 green for hardened gaps
- Phase 22 input pack honest about blockers

**Explicit blockers (examples):** optional provision/activation/migration engine/portal/payment/e-sign typed unavailable; rich report polish; Prisma EPERM → SQL fallback.

---

## 14. Out of scope

- Complete Training delivery (PRD 22 / tree-18)
- Complete data-migration platform (Phase 29)
- Complete communication integrations (Phase 28)
- Adoption management (tree-19)
- Pilot/rollout/hypercare programme (Phase 35)
- AI-generated completion/acceptance
- Parallel second onboarding domain
- Folder renames that delete working CS code

---

## 15. Downstream (Phase 22)

Phase 22 consumes the Training handoff (products/modules/roles/participants/contacts/dates/objectives/checksum) and owns Training Programs, curricula, trainers, cohorts, sessions, attendance, assessments, completion, and certificates — without inventing delivery from empty foundations.
