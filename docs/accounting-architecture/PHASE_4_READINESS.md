# Phase 4 Readiness — Full Accounting Posting Engine

## Foundations in place (Phase 2)

| Requirement | Status |
|---|---|
| Event catalogue (32 types, 20 modules, dimension policies) | ✅ `ACCOUNTING_EVENT_CATALOGUE.md` |
| Posting-command contract (context, source ref, dates, currency, dimensions, draft) | ✅ `postAccountingEvent` + Zod `postingCommandSchema` |
| Idempotency foundation (DB-enforced registry, content hash, replay semantics) | ✅ tested |
| Account-mapping contract with explicit failure | ✅ (backing swaps in Phase 3) |
| Period-resolution contract (deny-by-default) | ✅ (calendar in Phase 8) |
| Transaction boundary (rollback, classified retry) | ✅ tested |
| Journal validation (structural: balance, line rules, dimensions) | ✅ in draft factory |
| Approval contract (`ApprovalStatus`, config `requireJournalApproval/ReversalApproval`) | ✅ fields + config; enforcement in engine |
| Audit contract (attempts, AuditLog extension, actions catalogue) | ✅ |
| Outbox contract (same-transaction enqueue; dispatcher pending) | ✅ table + API |
| Posting modes + server flags + admin control | ✅ NEW_ENGINE deliberately refused |
| Shadow comparison harness | ✅ |

## Phase 4 must build

1. **Posting templates** per event type: mapping-key → draft-line generation for all 32
   events (start with EXPENSES and MANUAL_JOURNAL — smallest legacy divergence; POS/SALES last —
   highest volume + tax gross/net defect R-22 to fix in template design).
2. **Contextual journal validation service**: account tenancy/active/posting checks + period
   check + approval gate as one pre-commit validator (pieces exist; compose them).
3. **V2 canonical journal persistence** (may land early Phase 5): until then NEW_ENGINE mode
   stays refused.
4. **Outbox dispatcher** (cron route or worker) + retry policy.
5. **Engine-side hardening of `postGlEntry` delegation**: tenant filter inside
   `assertAccountsAllowDirectPosting` (closes SEC-1 at the source, not only at the adapter).
6. **Operational-module wiring plan** (which routes construct commands first) — sequenced in
   `PHASE_2_REMEDIATION_BACKLOG.md` P0-6 order.

## Cutover prerequisites (unchanged from strategy docs)

Shadow thresholds met per module; legacy trigger disabled atomically with NEW_ENGINE flag;
rollback rehearsed; Phase 3 mappings complete for every template the module needs.
