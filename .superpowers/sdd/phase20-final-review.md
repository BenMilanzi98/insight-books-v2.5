# Phase 20 Final Review — Lead Conversion / Closed-Won (post-I1)

**Head:** `WORKING_TREE` (BASE `7d9709a`; Phases 7–20 dirty)  
**Scope:** Waves 0–4 conversion plane (`lib/admin/crm/conversions/**`, close/acceptance harden, phase-20 docs, Vitest Wave 1–4)  
**Spec / plan:** `docs/superpowers/specs/2026-07-31-lead-conversion-closed-won-phase-20-design.md` · `docs/superpowers/plans/2026-07-31-lead-conversion-closed-won-phase-20.md`  
**Claimed exit:** `READY_FOR_PHASE_21_WITH_BLOCKERS` (`docs/admin-intelligence-crm/phase-20/FINAL_READINESS_DECISION.md`)  
**Package:** `.superpowers/sdd/phase20-final-review-package.md`  
**Ledger:** `.superpowers/sdd/progress-phase20.md`  
**Prior wave reviews:** Task 1–3 Approved with notes (post-fix); Task 4 Approved  
**Prior final:** Approved with notes (I1 open) → fix report `.superpowers/sdd/phase20-final-fix-report.md`  
**Mode:** Read-only re-review after I1 (overwrite this file only)  
**Date:** 2026-07-31  

---

## Strengths

1. **One domain** — `CrmConversion*` only; no `SalesConversion*` parallel domain in `lib/`.
2. **Closed-Won readiness** — expired / superseded / UNKNOWN authority / unapproved discount / SoD block READY; view/open/silence ≠ acceptance; UNKNOWN ≠ READY.
3. **HANDED_OFF commercial truth (I1 fixed)** — prior handoff is historical INFO only; full version expiry/supersede/withdrawn + authority + discount evaluation still runs; `HANDED_OFF` only when derived status remains `READY`; meta `handedOffDoesNotBypassCommercialTruth: true`.
4. **Acceptance authority persist** — `authorityStatus` on schema + SQL fallback; role alone never implies VERIFIED.
5. **Saga / snapshot** — exact retry same Conversion; commercial snapshot lock + checksum; locked deep-copy preferred over live Proposal edits.
6. **Duplicates** — EXACT_MATCH / HIGH_CONFIDENCE block auto-CREATE; LINK_EXISTING only; no auto-merge; contact cross-Customer denied.
7. **Request honesty** — strip fabricated provision args; payment initiation ≠ PAID; activation needs authoritative payment evidence.
8. **Onboarding handoff** — one-active + supersession + server checksum; `createsOnboardingProject: false`.
9. **Wave 4 honesty** — gate fail → UNAVAILABLE / `value: null`; unscoped metrics fail-closed; recon never invents `lineageIntact: true`.
10. **Exit pack** — Wave 0 forensic + CS 17–19 quarantine; Phase 21 inputs honest about provider / execution blockers.

---

## Hunt checklist

| Hunt | Result |
|------|--------|
| Fabricated ACTIVATED/PROVISIONED/PAID/acceptance/approval | **Holds** |
| Snapshot mutability after lock | **Holds** |
| EXACT_MATCH auto-create; auto-merge | **Holds** |
| Handoff creates Onboarding Project | **Holds** |
| False zeroes; unscoped search/export | **Holds** (metrics UNAVAILABLE); search/export empty+failClosed on missing scope |
| Expired/superseded Closed-Won | **Holds** — including LIVE prior-handoff path (I1 closed) |
| Authority bypass | **Holds** — including LIVE prior-handoff path (no invented “Authority verified”) |
| Parallel SalesConversion domain | **Absent** |

### I1 LIVE re-check (post-fix)

`evaluateClosedWonReadiness` in `lib/admin/crm/commercial/readiness.js`:

- Loads `priorHandoff` but does **not** short-circuit.
- Always evaluates acceptance fields, `crmCommercialDocumentVersion` status / `expiresAt`, authority status, discounts.
- Adds `phase16_handoff` as non-blocking INFO when handoff exists.
- Sets `HANDED_OFF` **only if** `deriveStatus(items) === READY` and prior handoff exists.
- Expired / superseded / invalid authority → `BLOCKED` / `NOT_READY` / `UNKNOWN`; may still return `handoffId`.

Vitest Wave 1–4 re-run this review: **40/40 PASS** (includes expired / superseded / invalid-authority + happy HANDED_OFF cases).

---

## Issues

### Critical

None.

### Important

None remaining. **I1 closed** per fix report and LIVE verification above.

### Minor (carry — non-blocking / WITH_BLOCKERS)

#### [M1] `resolveConversionListScope` trusts caller `tenantIds` / `teamIds` / `territoryIds` / `customerIds` without intersecting admin CRM membership — documented in `PHASE_21_INPUTS` carry gaps; HTTP metrics not yet fleet-wired.
#### [M2] Pipeline Closed-Won without acceptanceId / ACCEPTANCE evidence still skips commercial readiness unless `requireCommercialReadiness` — commercial-backed path hardened; bare REFERENCE close remains.
#### [M3] Snapshot lock idempotent replay with different payload returns prior lock without `idempotency_input_conflict` (immutability holds; conflict signalling weak).
#### [M4] Concurrent onboarding handoff creates (different keys) can race past one-active check (Task 3 Minor).
#### [M5] Search `findMany` catch → `ok: true` + omit/empty (Task 4 note); export query-fail correctly UNAVAILABLE.
#### [M6] Thin AdminShell hubs / closed-won aliases; Prisma EPERM → SQL / `hasCrm*Model` — documented WITH_BLOCKERS.

---

## Risk

| Area | Residual risk |
|------|----------------|
| Fabricated provision / PAID / acceptance | **Low** |
| EXACT_MATCH auto-create / auto-merge | **Low** |
| Onboarding Project from handoff | **Low** |
| False KPI zeroes / unscoped metrics | **Low** |
| Expired/superseded after prior handoff | **Low** — I1 fixed |
| Caller scope ID trust (library) | **Low–Med** — M1; named carry blocker |
| Documented optional blockers | **Expected** — WITH_BLOCKERS pack |

Vitest Phase 20 Wave suites: **40/40 PASS** (re-run 2026-07-31).

---

## Assessment vs claimed exit

**Claimed:** `READY_FOR_PHASE_21_WITH_BLOCKERS`  
**Reviewer verdict:** **Approved for exit as claimed**

I1 HANDED_OFF commercial-truth bypass is fixed and LIVE-verified. Hard-rule hunts hold; exit pack and CS quarantine remain honest. Residual Minors M1–M6 are carry items already aligned with WITH_BLOCKERS / Phase 21 inputs — not exit blockers beyond the claimed posture.

**Findings tally (residual):** Critical **0** · Important **0** · Minor **6**  
**Strengths preserved:** single CrmConversion domain, readiness/acceptance/SoD (incl. post-handoff re-check), snapshot immutability, EXACT_MATCH gates, request≠result honesty, handoff≠Project, Wave 4 fail-closed metrics, Phase 21 WITH_BLOCKERS pack.
