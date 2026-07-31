# Phase 21 Scope — Customer Onboarding (PRD)

**PRD:** Phase 21 — Customer Onboarding Management  
**Canonical code:** `lib/admin/customerSuccess/onboarding/**` + `CustomerOnboarding*` (tree phase-17)  
**Docs:** `docs/admin-intelligence-crm/phase-21/`  
**Prior alias pack:** `docs/admin-intelligence-crm/phase-17/` (MISLABELLED_PHASE vs PRD numbering; preserve)

## In scope

1. Forensic remapping of tree-17 onboarding ≡ PRD 21; quarantine Training (tree-18 / PRD 22) and Adoption (tree-19).
2. Harden Phase 20 onboarding handoff validate/accept (checksum, UNKNOWN ≠ VALID, idempotent accept).
3. Harden Request → Project spine (ONB- numbering, template pin, one active Project, status machines, materialisation honesty).
4. Readiness honesty: provisioning / subscription / entitlement / business-branch / user-access / config — request ≠ result; invitation ≠ ACCESS_VALID.
5. Coordination only: migration / Training / MRA EIS / integrations (no engines, no fiscal submit, no Training delivery).
6. Testing / defects / cutover coordination; go-live readiness → decision → execution → stabilisation.
7. Completion certificate + CS handover (checksum/idempotent); does not overwrite Customer Health.
8. Phase 22 Training handoff package (checksum/idempotent) — never create Programs/Sessions/attendance/certs.
9. Metrics/reliability/DQ/recon/search/exports/UI harden; fail-closed scopes; gate fail → never false zero.
10. Exit pack `READY_FOR_PHASE_22_WITH_BLOCKERS` + honest Phase 22 inputs.

## Out of scope

| Item | Reason |
|------|--------|
| Parallel second onboarding domain | FORBIDDEN — Approach 1 only |
| Delete/rename tree phase-17/18/19 code | Quarantine banners only |
| Training delivery (Programs/Sessions/certs) | FUTURE PRD 22 / tree-18 |
| Adoption Plans / interventions | FUTURE tree-19 |
| Full data-migration platform | Later phase (e.g. 29) |
| MRA EIS fiscal submission | WRONG_DOMAIN |
| Tenant GL / fake journals / System CoA admin | FORBIDDEN |
| Communication integrations platform | Later phase |
| Pilot/rollout/hypercare programme | Later phase |
| AI-generated completion/acceptance | FORBIDDEN |
| Create Onboarding Project from Phase 20 conversion | FORBIDDEN — handoff only upstream |

## Boundaries

| Upstream / peer | Boundary |
|-----------------|----------|
| Phase 20 conversion | Consume checksummed onboarding handoff; never mutate commercial snapshot |
| Platform Customer/Tenant/Subscription | Readiness evaluate + request; never fabricate ACTIVE/PROVISIONED |
| Phase 17 CRM Activities/Meetings | Kick-off / tasks reuse; RSVP ≠ attendance |
| Tree-18 Training | Coordination + Phase 22 handoff only |
| Tree-19 Adoption | Attach/handover only later; not Phase 21 completion |
| Phase 8 CsOnboardingRecord | REUSE_WITH_RECONCILIATION — never invent Project COMPLETED |

## Gap depth

Critical/High truth/security harden only (Approach A). Optional polish remains WITH_BLOCKERS.
