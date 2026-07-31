# Phase 9 — Operational Module Accounting Integration

Connect every financially relevant operational module to the central Accounting
Posting Engine and shut down unsafe legacy / bypass writers.

## Start here

1. [PHASE_1_TO_8_EVIDENCE_INDEX.md](./PHASE_1_TO_8_EVIDENCE_INDEX.md)
2. [CURRENT_OPERATIONAL_ACCOUNTING_PATHS.md](./CURRENT_OPERATIONAL_ACCOUNTING_PATHS.md)
3. [OPERATIONAL_EVENT_POSTING_MATRIX.md](./OPERATIONAL_EVENT_POSTING_MATRIX.md)
4. [TARGET_OPERATIONAL_INTEGRATION_ARCHITECTURE.md](./TARGET_OPERATIONAL_INTEGRATION_ARCHITECTURE.md)
5. [PHASE_9_TASKS.md](./PHASE_9_TASKS.md)
6. [MODULE_CUTOVER_FRAMEWORK.md](./MODULE_CUTOVER_FRAMEWORK.md)
7. [STAGE_1_2_INTEGRATION.md](./STAGE_1_2_INTEGRATION.md)
7b. [STAGE_3A_INTEGRATION.md](./STAGE_3A_INTEGRATION.md)
7c. [STAGE_3B_INTEGRATION.md](./STAGE_3B_INTEGRATION.md)
7d. [STAGES_3C_TO_7.md](./STAGES_3C_TO_7.md)
7e. [REMAINING_STAGES_PLAN.md](./REMAINING_STAGES_PLAN.md)
8. [LEGACY_POSTING_SHUTDOWN_REGISTER.md](./LEGACY_POSTING_SHUTDOWN_REGISTER.md)
9. [FINAL_PHASE_9_REPORT.md](./FINAL_PHASE_9_REPORT.md) (Option B)
10. [PHASE_10_11_12_READINESS.md](./PHASE_10_11_12_READINESS.md)

## Code map (as implemented)

| Area | Location |
| --- | --- |
| Adapters | `lib/accountingV2/adapters/**` |
| Templates | `lib/accountingV2/templates/**` |
| Engine | `lib/accountingV2/engine/postingEngine.js` |
| Source state | `lib/accountingV2/engine/sourcePostingState.js` |
| Legacy guard | `lib/accountingV2/engine/legacyGuard.js` |
| Flags | `lib/accountingV2/infrastructure/featureFlags.js` |
| Tests | `test/accountingV2.integrations*.test.js` |

## Non-negotiables

- No operational module creates Journal Entry / Lines / balances directly.
- Period assignment is server-side (Phase 8).
- Idempotency via event registry; webhooks/imports/jobs must be replay-safe.
- NEW_ENGINE disables legacy for that event; never both authoritative.
- Shadow journals never affect reports.
