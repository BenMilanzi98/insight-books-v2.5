# Transactional Outbox

Implementation: `lib/accountingV2/infrastructure/outbox.js` (Phase 2
foundation, `AcctV2Outbox` table), used by the posting engine.

## Events emitted

On successful posting, written **in the same database transaction** as the
journal:

- `ACCOUNTING_EVENT_POSTED`
- `JOURNAL_POSTED`
- `SOURCE_ACCOUNTING_STATUS_CHANGED`

Shadow postings emit shadow-scoped events; comparison requests can emit
`ACCOUNTING_INTEGRITY_CHECK_REQUESTED` / `LEDGER_READ_MODEL_REFRESH_REQUESTED`
for Phase 5 consumers.

## Guarantees

1. **Same-transaction creation** — an outbox row exists iff the posting
   committed. A rolled-back posting leaves no outbox record (asserted by the
   rollback tests).
2. **No pre-commit publication** — nothing external is notified before
   commit; delivery is a separate post-commit concern.
3. **Idempotent processing** — outbox rows carry the accounting event ID and
   a unique row identity; consumers must treat redelivery as a no-op.
   Outbox retries can never create journals: delivery only *reads* posted
   state, and any re-entry into the engine hits the idempotency layer.
4. **Tenant-scoped** — every row carries `tenantId`; workers filter by scope.
5. **Retryable + observable** — rows track attempts/status for the dispatcher;
   diagnostics expose queue depth.

## External side effects

Email, SMS, WhatsApp, PDF generation, payment-gateway calls, webhook delivery
and file uploads are **never** performed inside the accounting transaction —
they subscribe to committed outbox events. A failed email cannot roll back a
posting; a failed posting produces no success event, so no success receipt can
be sent.
