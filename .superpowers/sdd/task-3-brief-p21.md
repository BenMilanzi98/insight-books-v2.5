### Task 3: Wave 3 — Go-live / completion / CS handover / Phase 22 Training handoff

**Files:** Harden `goLive.js`, `stabilisation.js`, `completion.js`, CS handover, `training.js` Phase 22 handoff; test Wave 3

**Interfaces / hardens:**
- Go-live readiness UNKNOWN ≠ READY; Critical/High defects block
- Decision SoD; execution ≠ schedule; rollback preserves evidence
- Completion requires go-live + stabilisation + acceptances + CS handover + recon (not go-live alone)
- Certificate checksum idempotent; COMPLETED_WITH_GAPS explicit
- Phase 22 Training handoff checksum/idempotent; never create Programs/Sessions/attendance/certs
- CS handover does not overwrite Customer Health

- [ ] Write failing Vitest → implement → PASS Waves 1–3
- [ ] SDD review gate before Wave 4

---
