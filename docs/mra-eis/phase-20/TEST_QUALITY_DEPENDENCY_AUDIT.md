# Test Quality Dependency Audit

| Mechanism | Classification |
|---|---|
| Vitest unit suites `test/mraEis.phase*.test.js` (~22 files) | REUSE / EXTEND |
| Mock MRA activation/config/catalogue/sales servers | REUSE / EXTEND |
| Phase 18 admin command guards | REUSE |
| Phase 19 migration Dry Run / hooks | REUSE |
| `npm run qa:certify` (non-EIS) | NOT_APPLICABLE for EIS / EXTEND via `mra-eis:release-gate` |
| Permanent skipped EIS tests | NONE found in mraEis suites |
| Production data fixtures | ENVIRONMENT_UNSAFE — prohibited; synthetic only |
| Broad uncontrolled snapshot updates | FALSE_POSITIVE_RISK — avoided |
| Live Sandbox in default CI | BLOCKED_BY_CONTRACT |
| Load/soak without Staging | MISSING_COVERAGE → documented blocker |

---
*Phase 20 — Complete automated testing, security, reliability and release readiness. Mock success ≠ Sandbox certification ≠ Production readiness. Production MRA is never called automatically. No historical Sale submission. No Critical/High code defects remaining in CI suite. Carry-forward: authorized Sandbox contracts, Staging load/soak/chaos, Production migration extract.*
