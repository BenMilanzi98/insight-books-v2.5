# Phase 21 — Certification, Pilot, Rollout & Hypercare

**Decision:** `BLOCKED` (live Production) / framework `CONTROLS_READY_PRODUCTION_BLOCKED`

## Entry
- Domain: `lib/mraEis/application/phase21/`
- API: `/api/mra-eis/phase21`
- UI: `/settings/integrations/mra-eis/phase21`
- Tests: `test/mraEis.phase21.rollout.test.js`
- CLI: `npm run mra-eis:phase21-status`

## Hard rules
- Revalidate Phase 20 Release Gate before any Production action
- No self-declared MRA certification
- Sandbox certification ≠ Production certification
- Four-eyes credential provisioning via `secret-provider://` only
- Explicit pilot scope; no enable-all
- Hypercare exit not based on elapsed days alone

---
*Phase 21 — Certification, controlled pilot, cohort rollout, Hypercare and BAU handover. Sandbox ≠ Production certification. Mocks ≠ Sandbox. No auto Tenant/Business enablement. Secret Provider credentials only. No historical transmission. Hypercare exit is objective, not time-based. Honest status: controls READY; live Production BLOCKED pending authorized Sandbox/certification.*
