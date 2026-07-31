# Repair Idempotency

Repair identity: `(businessId, anomalyId, repairType, repairVersion)` — a
database unique constraint on `AcctV2RepairAction`. The identity is claimed by
inserting the action row before any financial work.

Guarantees (all covered by tests):

1. **Same repair twice** — the second execution finds the completed action with
   a matching `commandHash` and replays the stored result
   (`wasExistingRepair: true`). No second journal is created.
2. **Changed instructions under the same key** — a differing `commandHash` is
   rejected: "conflicting instructions under the same repair identity; bump
   repairVersion for a new repair."
3. **Concurrent execution** — the unique insert makes one writer win; the loser
   receives P2002 and resolves to replay/conflict/resume deterministically.
4. **Retry after failure** — a `FAILED` action with the same hash is re-opened
   (`PENDING`, attempt count incremented, previous error preserved in the audit
   trail) and completes as the SAME action. The posting engine re-opens its own
   FAILED event registry row the same way, so the journal side is also
   exactly-once.
5. **Duplicate reversal / missing-journal prevention** — the journal is keyed by
   the action id through the posting engine's event registry
   (`AcctV2RepairAction:<actionId>` + `HISTORICAL_REPAIR_POSTED`), which has its
   own idempotency key; a posted event can never post again.

The command hash is SHA-256 over the canonical repair instructions (repair
type/version, anomaly, business, proposed journal, metadata changes, original
journal, posting date). Operators never need to remember whether a script ran:
re-running is always safe.
