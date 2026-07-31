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
