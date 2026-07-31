# Baseline Test Execution Report

**Phase:** 2 — Internal Architecture Audit  
**Audit date:** 2026-07-22

## Commands (actual package.json)

| Command | Start | End | Result | Notes | EIS impact |
|---|---|---|---|---|---|
| `npm run lint` (`eslint . --max-warnings 999`) | 2026-07-22 | 2026-07-22 | **FAIL (exit 2)** | ESLint 9.39.4: config references `react/no-unescaped-entities` but plugin `react` not found | Pre-existing tooling defect; not EIS-specific |
| `npx vitest run test/accountingV2.postingEngine.test.js test/authz.test.js` | 2026-07-22 | 2026-07-22 | **PASS (exit 0)** | 53 passed, 4 skipped, 2 files | Posting idempotency + authz baseline healthy |
| `npm run build` | — | — | **NOT RUN in this pass** | Full Next production build deferred (long); run before Phase 3 coding slices | Required before claiming deploy readiness |
| `npx tsc --noEmit` | — | — | **NOT RUN** | Mixed JS/TS repo; no hard gate in scripts | Optional |

## Policy

Existing unrelated failures are documented honestly. Lint failure is an environment/config issue, not introduced by Phase 2 docs.

## Recommended before Phase 3 implementation

1. Fix ESLint react plugin config (or use `lint:next`).
2. Run `npm run build` on a clean machine.
3. Run `npm run test:integration` for accounting V2 suite.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
