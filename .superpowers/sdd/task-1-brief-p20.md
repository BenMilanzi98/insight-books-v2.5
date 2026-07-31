### Task 1: Wave 1 — Closed-Won readiness, acceptance, authority, approvals harden

**Files:**
- Harden: `lib/admin/crm/conversions/` readiness modules; `lib/admin/crm/opportunities/close.js`; commercial acceptance/authority/approval validators as identified in Wave 0 gaps
- Thin UI/API only if Critical path broken
- Test: `test/systemAdmin.crm.conversionPhase20Wave1.test.js`

**Interfaces:**
- Produces / hardens:
  - Server readiness: expired/superseded/unaccepted commercial → not READY; UNKNOWN ≠ READY
  - Acceptance never inferred from view/open/silence
  - Authority UNKNOWN / VERIFICATION_REQUIRED blocks Closed-Won where policy requires
  - Required approvals/discounts SoD-enforced
  - `closeOpportunityWon` + conversion create remain idempotent; no provision side effects on close alone

- [ ] **Step 1: Write failing Vitest** — expired quote blocks; superseded proposal blocks; view≠acceptance; unknown authority blocks; unapproved discount blocks; exact Closed-Won/conversion retry same id
- [ ] **Step 2: Run** — expect FAIL on gaps
- [ ] **Step 3: Implement** minimal harden
- [ ] **Step 4: Re-run Wave 1** — PASS
- [ ] SDD review gate before Wave 2

---
