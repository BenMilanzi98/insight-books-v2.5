# POS Architecture Audit

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

## Flow (evidence)

`app/pos/page.js` → `createSale` → `POST /api/sales` → `$transaction`: Sale+items → inventory → payments → FIFO COGS → journals/tax → audit → **commit** → `eisService.submitInvoice` fire-and-forget → receipt modal.

## Insertion points (recommendation)

| Concern | Safe point |
|---|---|
| EIS eligibility | End of tx before commit, after totals finalized |
| Immutable snapshot + Outbox | **Same DB transaction** as sale finalize |
| MRA transmission | **After** commit, durable worker |
| Receipt QR | After ACCEPTED (or certified offline) — pending state until then |

## Controls

| Control | Current |
|---|---|
| Double-click | UI inFlight only |
| Server idempotency | **Missing** |
| Offline | IndexedDB queue; local signature ≠ MRA |
| Browser secrets | Must never hold secretKey |

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
