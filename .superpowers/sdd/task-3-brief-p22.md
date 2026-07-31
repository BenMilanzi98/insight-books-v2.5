### Task 3: Wave 3 — Sessions / attendance / assessments / completion / certificates / outcome handoffs

**Files:** Harden `sessions.js`, `attendance.js`, `exercises.js`, `assessments.js`, `attempts.js`, `grading.js`, `completion.js`, `certificates.js`, environment boundary, CS/PA handoff emit modules; test Wave 3

**Interfaces / hardens:**
- Calendar/Meeting typed boundary; provider missing → typed NOT_CONFIGURED; schedule ≠ delivered
- Invitation/calendar/link ≠ attendance; attendance evidence required; corrections append-only
- Exercises: no Production GL/journals/stock/MRA fiscal
- Assessment versions immutable when published; attempt/time limits server-side; answer-key protection
- Completion policy versioned; attendance alone ≠ COMPLETED (unless explicit policy); COMPLETED_WITH_GAPS explicit
- Certificate eligibility UNKNOWN ≠ issue; checksum/idempotent; revoke preserves history
- CS handoff does not overwrite Customer Health; PA handoff source-labelled only (no usage/first-value fabrication)
- Training Participants ≠ auto Leads; attendance ≠ Marketing attribution

- [ ] Write failing Vitest → implement → PASS Waves 1–3
- [ ] SDD review gate before Wave 4

---
