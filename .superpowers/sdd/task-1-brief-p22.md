### Task 1: Wave 1 — Handoff validate/accept + Request/Program spine harden

**Files:** Harden `handoffConsume.js`, `requests.js`, `programs.js`, `status.js`, `numbering.js`, `catalogue.js` (phase: 22, treePhaseAlias: 18, source retarget); test `test/systemAdmin.cs.trainingPhase22Wave1.test.js`

**Interfaces / hardens:**
- Phase 21 handoff checksum validation; UNKNOWN ≠ VALID
- `acceptTrainingHandoff` (or equivalent consume/accept) idempotent; exact retry same
- Correction/supersession preserves history
- Request create/idempotent; Program create after accept; TRN- numbering; template/curriculum pin; duplicate active Program purpose blocked; conflicting idempotency fails
- Source codes retargeted (`PHASE_21_TRAINING_HANDOFF` primary; legacy PHASE_16/17 aliases mapped)
- Invalid status transitions throw

- [ ] Write failing Vitest → implement → PASS Wave 1
- [ ] SDD review gate before Wave 2

---
