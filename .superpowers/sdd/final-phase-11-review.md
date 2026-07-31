# Final Phase 11 Review — CRM Core Foundation

**Reviewer role:** Senior Code Reviewer (defect-first, whole-branch / working-tree)  
**Date:** 2026-07-30  
**Scope:** Phase 11 Waves 0–4 (Tasks 1–4 via SDD), working tree (no commits)  
**Sources:** `docs/superpowers/plans/2026-07-30-crm-core-phase-11.md`, `docs/superpowers/specs/2026-07-30-crm-core-phase-11-design.md`, `.superpowers/sdd/progress-phase11.md`, `docs/admin-intelligence-crm/phase-11/FINAL_PHASE_11_REPORT.md`, live paths under `lib/admin/crm/**`, `app/api/admin/crm/**`, `app/insightbooks/crm/**`, public capture routes, SQL wave1–4, related Vitest suites / prior task reviews.

**Exit claim under review:** `READY_FOR_PHASE_12_WITH_BLOCKERS`

---

## Verdict

**Ready to commit with caveats.**

Phase 11 delivers an honest dedicated CrmLead / CrmAccount / CrmContact plane (≠ Customer ≠ SupportTicket ≠ CsCase ≠ POS `sales.*`), with idempotent capture, versioned qualification, deterministic explainable scoring (not probability), consent/DNC eligibility, merge SoD, opportunity-readiness handoff without Opportunity create, and admin My Work / list / detail. No Critical (P0) defects found against the locked hard rules when Prisma CRM models are present.

Important residual authz/privacy items remain — chiefly **owner scope still `mode: 'all'`** (documented Phase 12 blocker) and **fail-open QUALIFIED when the response model is missing** — but they match the WITH_BLOCKERS exit and ledger. Isolate CRM paths at commit time (~1020 dirty paths in the tree).

---

## Security triage (requested focus)

| Gate | Result | Evidence |
|------|--------|----------|
| Owner / team / territory scope | **Open / Important** — still `mode: 'all'` | `lib/admin/crm/authz.js` `resolveCrmScope` returns `mode: 'all'`, `stub: true`. List/export see all leads for any `viewLeads` holder. Documented FINAL report blocker #9 + ledger P11-T3. |
| Consent never inferred; DNC via eligibility | **Pass (Wave 3 path)** | `recordConsent` requires `source`; `checkCommunicationEligibility` blocks UNKNOWN/DENIED/WITHDRAWN/EXPIRED/PENDING + channel/all DNC. Capture snapshot GRANTED only when client sends `consentPurposes` (does **not** write `CrmConsentRecord`). |
| Merge SoD | **Pass** | `approveMerge` rejects `approverId === requesterId` (`SOD_VIOLATION`). Execute requires `APPROVED`; evidence preserved; no auto-merge. Wave4 tests cover self-approve. |
| Capture idempotency | **Pass** | Server-derived key; client key ignored; pre-check + `P2002` replay on Lead + Capture unique indexes (schema + SQL wave1/2). |
| Score ≠ probability | **Pass** | Engine/`isProbability: false`; forbidden labels; UI `scoreNeverProbability`; readiness handoff sets `isProbability: false` and never invents `scoreVersionId`. |

---

## Findings (severity-ranked)

### [P2] Owner/team/territory list scope remains `all` — `lib/admin/crm/authz.js:134-163`

`resolveCrmScope` grants full CRM visibility to any admin with domain view. `listLeads` / accounts / contacts / export inherit this (`scopeMode: 'all'` in meta). Any future non-super sales role with `viewLeads` sees every lead (PII).

**Triage:** Ledger **P11-T3** + FINAL blocker #9 — **accepted for Phase 11 WITH_BLOCKERS**, not a silent regression. Must ship real owner/team/territory filters before multi-rep CRM.

---

### [P2] QUALIFIED transition soft-skips when response model missing — `lib/admin/crm/qualification/evaluate.js:363-372`

`assertLeadQualificationForQualifiedStatus` returns `{ ok: true, skipped: true }` when `crmQualificationResponse.findMany` is not a function. Hard rule is “cannot mark QUALIFIED while required criterion is UNKNOWN,” but pre-generate / partial client environments (FINAL blocker #10 Windows EPERM) fail **open**.

When the model **exists**, empty responses correctly block (`QUALIFICATION_INCOMPLETE`).

**Triage:** Ledger **P11-T3** minor — elevate to Important for ops: prefer fail-closed (`ok: false`, `UNAVAILABLE`) before production if client/schema can lag. Acceptable for foundation commit with caveat.

---

### [P2] `editLeads` bundles transition / qualify / score / consent / assign / merge-request — `lib/admin/crm/authz.js`

Fine-grained permissions exist in `SYSTEM_ADMIN_PERMISSIONS.crm.*`, but runtime gates OR with `editLeads` (and create for some). `canApproveMerge` correctly stays `mergeLeads`-only (SoD preserved at approve). Privilege separation for consent and status transition is weaker than the permission catalogue suggests.

**Triage:** Ledger **P11-T1** (`editLeads` also grants transition) confirmed; extend note to consent/score/qualify. Non-blocking for System Admin–only rollout; tighten before broader CRM roles.

---

### [P2] Public capture marks snapshot `GRANTED` from unvalidated `consentPurposes` — `lib/admin/crm/capture.js:343-348`, `publicFormApi.js`

Any public POST may send `consentPurposes: ['…']` (including strings outside `CRM_CONSENT_PURPOSE`, e.g. test `SALES_FOLLOW_UP`) and get `capture.consentStatus = GRANTED`. No checkbox proof, purpose allowlist, or `CrmConsentRecord` write. Eligibility remains fail-closed (UNKNOWN without contact consent), so outbound gate is safe today — but the capture row can **over-claim** consent for ops/reporting if trusted later.

**Triage:** Intentional per capture tests; keep UNKNOWN unless purpose ∈ catalogue **and** treat as capture interest flag, not legal GRANTED, until Wave 3 consent is recorded with source.

---

### [P3] In-process capture throttle only — `lib/admin/crm/capture.js:25-28,95-107`

`throttleBuckets` is process-local (8 / 60s / email). Multi-instance / serverless deployments do not share limits. Honeypot + payload size remain. Ledger **P11-T2**.

---

### [P3] Handoff synthetic `@crm.internal` identity — `lib/admin/crm/handoffIntake.js:108-112`

Missing email/phone gets `handoff+{type}.{id}@crm.internal` for capture identity / idempotency. Correctly documented as non-contact address; risk is later accidental Contact materialization. Ledger **P11-T2**.

---

### [P3] Lead create lacks FK pre-validation; status+history not transactional — `lib/admin/crm/leads.js`

Admin `accountId` / `contactId` rely on Prisma FK (500 on bad id vs structured `*_not_found`). Status update and `CrmLeadStatusHistory` are sequential, not `$transaction`. Merge execute similarly non-transactional. Ledger **P11-T1**.

---

### [P3] Optional idempotency race / numbering waste — `lib/admin/crm/capture.js`, `leads.js`

Concurrent first-inserts rely on unique `sourceIdempotencyKey` + `P2002` replay (sound). Loser of a race may still consume a number sequence tick. Acceptable.

---

### [P3] No HTTP route tests — ledger **P11-T1**

Service-layer Vitest (report: 60 tests / 8 files) covers capture, qualify, score, assignment, consent, merge, readiness. Admin/public route wiring (auth → status codes) untested. Acceptable for foundation exit.

---

### [P3] Working tree mixes Phases 7–11 (~1020 dirty paths)

CRM-scoped churn is a small slice. Commit isolation required so Phase 11 is reviewable/revertable (same hygiene as Phase 10 final review).

---

## Ledger minors — disposition

| Ledger item | Disposition |
|-------------|-------------|
| P11-T1: editLeads → transition | **Confirmed** → rolled into P2 privilege bundling |
| P11-T1: Lead create FK pre-validation | **Confirmed** → P3 |
| P11-T1: optional idempotency race | **Confirmed mitigated** by unique + P2002 → P3 residual |
| P11-T1: status+history not transactional | **Confirmed** → P3 |
| P11-T1: no HTTP route tests | **Confirmed** → P3 |
| P11-T2: in-process throttle | **Confirmed** → P3 |
| P11-T2: handoff `@crm.internal` | **Confirmed** → P3 |
| P11-T3: QUALIFIED soft-skip if response model missing | **Confirmed / elevated** → P2 |
| P11-T3: scope still `all` | **Confirmed** → P2 (Phase 12 blocker) |

---

## Hard-rule spot checks (pass)

- Lead ≠ Opportunity ≠ Customer ≠ Support ≠ CsCase — distinct models/APIs; `CONVERTED_TO_OPPORTUNITY` → `NOT_IMPLEMENTED`.
- Merge: request → approve → execute; requester ≠ approver; evidence JSON; loser `MERGED` + `mergedIntoLeadId`; history kept.
- Opportunity readiness: `opportunityCreated: false`, `opportunityId: null`; READY blocked when eligibility fails.
- Email / WhatsApp Lead ingest: `NOT_AVAILABLE` in capture channel gates + foundations UI badges.
- Restricted notes: service-layer omit for non-privileged viewers.
- CoA admin route: out of CRM scope; not reintroduced by this phase.

---

## Test / residual risk

- Reported suite green (60/60 across wave1–4 CRM tests) — not re-executed in this read-only pass; trust FINAL report + task P11-4 re-review.
- Residual: apply schema/SQL before relying on QUALIFIED gate / capture uniqueness in a given environment; do not grant broad `crm.viewLeads` until scope filtering lands; do not treat capture `consentStatus` as legal consent.

---

## Commit readiness

**Ready to commit with caveats.**

Caveats before treating CRM as production-complete (aligned with `READY_FOR_PHASE_12_WITH_BLOCKERS`):

1. Isolate Phase 11 paths in the commit(s); do not bundle the full ~1020-path dirty tree blindly.
2. Apply Prisma/SQL wave1–4; until then QUALIFIED soft-skip and model guards may diverge from migrated behavior — prefer fail-closed QUALIFIED if shipping to shared envs with stale clients.
3. Keep `resolveCrmScope` stub on the Phase 12 critical path (blocker #9).
4. Do not wire capture snapshot GRANTED into eligibility or marketing senders without Wave 3 consent records + purpose allowlist.
5. Email/WhatsApp ingest, full import/reporting, Opportunity create remain explicit blockers per FINAL report.
