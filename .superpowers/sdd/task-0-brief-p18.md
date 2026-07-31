### Task 0: Wave 0 — Forensic audits + matrices + readiness

**Files:** Create `docs/admin-intelligence-crm/phase-18/` audit pack per master prompt §5 (CURRENT_* training audits, DQ/privacy/security/performance, gap register, IMPLEMENTATION_PLAN, PHASE_INPUT_VALIDATION). No application code.

**Interfaces:**
- Consumes: Phase 17 `PHASE_18_INPUTS.md`, `PHASE_18_READINESS_CHECKLIST.md`, design locks, Phase 16 `TRAINING_HANDOFF`, Phase 8 `CsTrainingRecord`, Phase 17 `training.js`
- Produces: CONDITIONAL GO / BLOCKED in `docs/admin-intelligence-crm/phase-18/FINAL_READINESS_DECISION.md` (Wave 0 interim; full final report in Wave 4)

- [ ] Validate Phase 17 exit `READY_FOR_PHASE_18_WITH_BLOCKERS` (handoff ≠ execute; COMPLETED gate requires Phase 18 domain source)
- [ ] Audit routes, handoffs, Requests/Programs/curricula/modules/cohorts/participants/trainers/sessions/venues/virtual/materials/env/attendance/exercises/assessments/results/completion/certificates/feedback/reports/exports/permissions — classify with prompt taxonomy
- [ ] Write CURRENT_* + TRAINING_* audits with real file paths (not empty)
- [ ] Matrices: source, domain, type, curriculum, module, role-module, participant, trainer, scheduling, attendance, assessment, completion, certificate, reliability, security
- [ ] `PHASE_18_GAP_REGISTER.md` + `IMPLEMENTATION_PLAN.md` (gaps → Waves 1–4) + Wave 0 readiness decision
- [ ] Stop — **no Wave 1 code** until user chooses Subagent-Driven or Inline after CONDITIONAL GO

---
