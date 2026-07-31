# Phase 9 Tasks

**Delivery choice:** Option B + Stage 3A — framework + Stage 1–2 + core
inventory GL (POS/COGS/GR/write-off); remaining stages scaffolded.

| WS | Task | Status | Notes |
| --- | --- | --- | --- |
| A | Phase 1–8 evidence review | DONE | PHASE_1_TO_8_EVIDENCE_INDEX.md |
| B | Operational posting inventory | DONE | CURRENT_OPERATIONAL_ACCOUNTING_PATHS.md |
| C | Integration architecture | DONE | TARGET_OPERATIONAL_INTEGRATION_ARCHITECTURE.md |
| D | Module Accounting Adapter framework | DONE | cutoverBridge + baseAdapter + index |
| E | Source Accounting Status | PARTIAL | `getSourcePostingState` / registry; no new columns |
| F | Source-to-journal linkage | PARTIAL | Event registry + adapter readback |
| G | Legacy posting shutdown register | DONE | Expanded LEGACY_SOURCE_SCOPE + doc |
| H | Feature-flag / cutover framework | DONE | MODULE_CUTOVER_FRAMEWORK.md |
| I–J | Stage 1 (expense, bank charge/interest) | DONE | Adapters + route/helper wiring |
| K–N | Stage 2 (invoice, payment, bill, supplier payment) | DONE | Adapters + helper/route wiring |
| O | Stage 3A (POS, COGS, GR, stock adj) | DONE | STAGE_3A_INTEGRATION.md |
| P | Stage 3B (credit notes + refunds) | DONE | STAGE_3B_INTEGRATION.md |
| Q | Stages 3C–7 remaining modules | DONE | STAGES_3C_TO_7.md, REMAINING_STAGES_PLAN.md |
| R | UI-pending (dividends, disposal, drawings API) | SCAFFOLD | scaffolds.js only |
| AM–AO | Import / webhook / job integration | DEFERRED | Stage 7 |
| AP | Operational UI accounting status | DEFERRED | Shared component later |
| AQ | Module reconciliation services | DEFERRED | After cutover evidence |
| AR–AS | Audit / observability / permissions | PARTIAL | Existing logger + engine perms |
| AT–AV | Tests + shadow + cutover | DONE | accountingV2.integrations.test.js |
| AW–AZ | Readiness Phase 10/11/12 + final report | DONE | Option B report |

Deferred by design: full Bank Reconciliation (Phase 10), full Equity workflow
(Phase 11), year-end close (Phase 12).
