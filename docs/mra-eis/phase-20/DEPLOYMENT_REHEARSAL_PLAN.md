# Deployment Rehearsal Plan

Staging: build → migrate → workers → smoke `npm run test:mra-eis` → release-gate. Not executed against Production in Phase 20.

---
*Phase 20 — Complete automated testing, security, reliability and release readiness. Mock success ≠ Sandbox certification ≠ Production readiness. Production MRA is never called automatically. No historical Sale submission. No Critical/High code defects remaining in CI suite. Carry-forward: authorized Sandbox contracts, Staging load/soak/chaos, Production migration extract.*
