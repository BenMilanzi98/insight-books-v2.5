# Setup Wizard Implementation Task Plan

**Date:** 2026-07-22  
**Approved forks:** **A3** (hybrid UI) · **B1** (one consolidated Opening Journal) · **C2** (policy SoD) · **D2** (controlled conversion)  
**Design spec:** `docs/superpowers/specs/2026-07-22-business-setup-wizard-design.md`  
**Implementation plan:** `docs/superpowers/plans/2026-07-22-business-setup-wizard.md`  
**Slice 1:** Foundation complete (Run + state machine + classifier + `/setup` shell).  
**Next:** Slice 2 — profile/ownership/calendar/CoA/mappings depth + domain capture.  
**Order:** Matches master prompt §68, condensed into phases.

---

## Phase 0 — Forensic (DONE)

- [x] Inspect onboarding / business create / wizard
- [x] Inspect calendar, CoA, mappings
- [x] Inspect opening balance / stock / AR / AP / assets / loans / equity
- [x] Inspect Posting Engine, GL, TB, approvals, audit, imports
- [x] `CURRENT_SETUP_IMPLEMENTATION.md`
- [x] `SETUP_WIZARD_GAP_REGISTER.md`
- [x] `OPENING_BALANCE_DATA_INTEGRITY_REPORT.md`
- [x] This task plan

---

## Design forks (APPROVED 2026-07-22)

| Fork | Choice | Meaning |
|---|---|---|
| A | **A3** | Full-page `/setup` + dashboard checklist launcher; login non-blocking |
| B | **B1** | One consolidated Opening Journal via existing `AcctV2OpeningBalanceBatch` |
| C | **C2** | Policy-driven SoD (solo admin may prepare+approve+post) |
| D | **D2** | Activity classifier + controlled conversion mode |

---

## Phase 1 — Domain model & state machine

1. Design `BusinessSetupRun` (+ steps, issues, approvals, posting result, reopen) — reuse domain tables for AR/AP/stock/assets/loans/equity where possible.
2. Status enums for run + step.
3. Migrations + constraints (one active run per business/version; unique posting identity).
4. Typed errors skeleton.
5. Docs: `SETUP_DOMAIN_MODEL.md`, `SETUP_STATE_MACHINE.md`.

---

## Phase 2 — Entry, resume, autosave

1. Full-page route + progress API.
2. Autosave + version conflict detection.
3. Business activity classifier.
4. Permissions scaffolding `setup.*`.
5. Docs: `SETUP_ENTRY_AND_RESUME.md`.

---

## Phase 3 — Profile → calendar → CoA → mappings

1. Business profile + legal structure.
2. Ownership (structure-aware; no auto capital).
3. FY / periods / OB date / cutover validation.
4. CoA template/import/customize.
5. System mapping validation (header/inactive/cross-business bans).

---

## Phase 4 — Domain opening capture

1. Payment accounts + opening lines → setup draft.
2. Customers + import; Opening Receivables (invoice-level preferred).
3. Suppliers + import; Opening Payables.
4. Items + Opening Stock (integrate stock basic import + GL event).
5. Fixed assets + accum dep; other assets.
6. Liabilities/loans; taxes; capital/equity; manual TB with control locks.

---

## Phase 5 — Preview, reconcile, documents

1. Opening TB preview + drill-down.
2. A = L + E display (never auto-zero).
3. Subledger reconciliations + issue centre.
4. Supporting documents store (business-scoped).

---

## Phase 6 — Approve, post, lock, reopen

1. Approval policy + SoD (FORK-C).
2. Final post via Posting Engine (FORK-B); idempotency.
3. Completion lock; completion pack.
4. Controlled reopen + reversal/adjustment (no edit of posted journals).
5. Kill remaining legacy OB call sites.

---

## Phase 7 — Hardening

1. Imports pack + templates.
2. Exports + notifications + audit completeness.
3. Responsive + a11y.
4. Migration strategy + SQL inventory + link orphans safely.
5. Tests: unit, posting, reconcile, multi-tenant, concurrency, E2E workflows.
6. Typecheck, lint, production build.
7. `FINAL_SETUP_WIZARD_REPORT.md` + remaining docs tree.

---

## Explicit non-goals until approval

- Visual-only stepper with no posting.
- Direct account balance updates.
- Declaring production setup-readiness.
- Fabricating historical Setup Run audit for legacy orphans.
