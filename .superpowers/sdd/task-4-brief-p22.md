### Task 4: Wave 4 — UI/metrics/DQ/recon/Phase 23 pack/exit

**Files:** Metrics/reliabilityGate/search/exports/DQ/recon/lineage harden; thin UI honesty; docs PHASE_23_INPUTS + checklist + FINAL report; exit `READY_FOR_PHASE_23_WITH_BLOCKERS`; test Wave 4

**Interfaces / hardens:**
- Gate fail → UNAVAILABLE / value null
- Search/export/DQ/recon fail-closed scoped; no answer keys / broad assessment responses
- Progress ≠ quality ≠ completion; completion ≠ adoption
- Phase 23 pack honest (identity/source/consent/communication-eligibility; Training ≠ acquisition)
- Mislabel map pointer (tree-18 ≡ PRD 22; Demo preserved)
- Exit decision recorded

- [ ] Write failing Vitest → implement → PASS Waves 1–4
- [ ] SDD final whole-branch review before exit ratification

---

## Spec coverage

| Spec area | Tasks |
|-----------|-------|
| Compatibility / mislabel / Demo preserve / quarantine | 0 |
| Handoff / Request / Program spine / source retarget | 1 |
| Curriculum / trainers / cohorts / enrolment | 2 |
| Sessions / attendance / assessments / completion / certs / CS+PA | 3 |
| UI / metrics / Phase 23 pack / exit | 4 |

## Execution notes

- **BASE_SHA:** `7d9709a897bc0d4609ce8a6725aad7d9cf1cb835` (WORKING_TREE; no commits unless user asks)
- Work in-place on `v2` (prior phases uncommitted — do not use clean worktree that omits them)
- Execution: Subagent-Driven (locked in design)
- SDD artifacts: `.superpowers/sdd/task-N-brief-p22.md`, `task-N-report-p22.md`, `task-N-review-p22.md`, `progress-phase22.md`
