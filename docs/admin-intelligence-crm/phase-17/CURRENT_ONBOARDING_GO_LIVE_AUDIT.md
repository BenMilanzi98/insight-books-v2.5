# Current Onboarding Go-Live Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Go-live readiness / approval / execution | NOT_FOUND | Spec `goLive.js` absent |
| Go-live success → STABILISATION (not COMPLETED) | NOT_FOUND | Status machine Wave 1/3 |
| UNKNOWN dimension treated as READY | GO_LIVE_TRUTH_RISK / FORBIDDEN | — |
| Conversion activation = go-live | WRONG_DOMAIN | `conversions/activation.js` — Subscription ACTIVE policy ≠ Customer go-live |
| Fabricated go-live from handoff | FORBIDDEN | Handoff `executionStatus` stays NOT_STARTED at emit |

**Implication:** Wave 3 go-live path with multi-dimension readiness; success enters stabilisation only.
