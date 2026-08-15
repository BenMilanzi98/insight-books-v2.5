# Task 7 report — Extract cloud `createSale` and idempotent outbox apply

Branch: `feat/desktop-offline-sync`
Commit: `1094131d1a6d21808b9b7030820cd0ab5ce72649` — 20 files (code + test only; no
`.superpowers`, `.next` or i18n files staged).

## Status

DONE_WITH_CONCERNS — every allowed kind is implemented and wired to a real service
(no silent no-ops, no second accounting engine), but four kinds are served by thin
adapters that replay the queued payload through the existing route handler instead of
a physical code move. Details and residual risks are in **Concerns** below.

## TDD

### RED

`test/desktop/outboxApply.test.js` written first (the two cases from the brief plus
four extra: receipt shape, sale-number pass-through, `UNKNOWN_KIND`, no receipt on
handler failure).

```
npx vitest run test/desktop/outboxApply.test.js
 FAIL  test/desktop/outboxApply.test.js
Error: Cannot find module '../../lib/desktop/cloud/outboxApply.js'
 Test Files  1 failed (1)
      Tests  no tests
```

### GREEN

After implementing `lib/desktop/cloud/outboxApply.js`:

```
npx vitest run test/desktop/outboxApply.test.js
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

### Final run (required by the brief)

```
npx vitest run test/desktop/outboxApply.test.js test/saleItemBaseQuantity.test.js
 Test Files  2 passed (2)
      Tests  9 passed (9)
```

Extra guard run: an import smoke test (temporary, deleted afterwards) loaded every
extracted module and every rewritten route to prove the ~1 300-line `createSale` move
and the lib→route adapters resolve and parse. It passed.

Full-suite context: `npx vitest run` ends 313 passed / 29 failed files. The failures are
pre-existing and unrelated — they live in `lib/accountingV2/*`,
`lib/transactionReversalService.js`, system-admin/UI page assertions and xlsx timeouts,
none of which this task touches. The source-inspection tests that do read the routes I
changed adjacent to (`test/invoicePartialPaymentSalesAccounting.test.js`) pass.

## What was built

### 1. `lib/desktop/cloud/outboxApply.js`

- `applyDesktopOutboxItem({ prisma, tenantId, user, deviceId, item, handlers, request })`
  → `{ serverId, result, duplicate }`.
- Idempotency: `desktopOutboxReceipt.findUnique({ where: { tenantId_id: { tenantId, id } } })`.
  A hit returns the stored `resultJson` / `serverEntityId` and never calls the handler.
- On success it writes `{ id, tenantId, deviceId, kind, serverEntityId, resultJson }`.
  A handler throw writes nothing, so the item stays replayable.
- Unknown kind → `Error` with `code: 'UNKNOWN_KIND'`.
- `handlers` is merged over the defaults, so tests can inject one kind and leave the
  rest intact.
- Default handlers use lazy `await import(...)` so unit tests never load Prisma/Next.

### 2. Real extracts (code physically moved, route becomes a wrapper)

| New lib module | Moved from | Route now |
| --- | --- | --- |
| `lib/sales/createSale.js` | `app/api/sales/route.js` POST (~1 330 lines) | auth → `createSale` → `NextResponse.json` |
| `lib/sales/voidSale.js` | `app/api/sales/[id]/void/route.js` POST | wrapper |
| `lib/sales/refundSale.js` | `app/api/sales/[id]/refund/route.js` POST | wrapper |
| `lib/invoices/createInvoice.js` | `app/api/invoices/route.js` POST | wrapper |
| `lib/invoices/voidInvoice.js` | `app/api/invoices/void/route.js` POST | wrapper |

`lib/serviceErrors.js` carries the HTTP contract across the extraction: each former
`return NextResponse.json(body, { status })` became `throw serviceError(...)`, and the
route re-renders `error.body` with `error.status`. Status codes and message strings are
unchanged.

Behaviour changes, deliberately limited to:

- `createSale({ user, body, saleNumber })` — a non-empty `saleNumber` skips
  `allocateNextSaleNumberReliable` and is persisted, after a duplicate check inside the
  same transaction.
- `createInvoice({ user, body, invoiceNumber })` — same idea for
  `allocateNextInvNumberReliable`.
- Verbose `console.log` tracing and three dead locals (`transactionAborted`,
  `hasServices`, `invoiceHasServices`) were dropped. No posting, ordering, validation,
  rounding or transaction-boundary change.

### 3. Thin adapters (no code moved)

`lib/invoices/updateInvoice.js`, `lib/invoices/recordInvoicePayment.js`,
`lib/payments/createPayment.js`, `lib/clients/upsertClient.js` (+ `archiveClient`) and
`lib/stock/adjustStock.js` call the existing route handler in-process through
`lib/callRouteHandler.js`, which builds a `Request` with the queued payload and forwards
the caller's cookie/authorization headers. Session auth resolves exactly as it does for a
normal call, and the handler's own validation, permission checks and GL posting run
untouched.

This was the deliberate choice for the four large handlers (invoices `[id]` PUT 560
lines, payments POST 822, stock `[id]` PUT 1 003, partial-payment 274): a physical cut
would have been a high-risk rewrite of live posting code with no test cover, which the
task brief explicitly allows avoiding.

### 4. `POST /api/desktop/outbox`

Body `{ deviceId, items: [{ id, kind, payload }] }`. Authenticates, requires the device
to be bound to the caller's tenant (`403 DEVICE_NOT_BOUND`), applies items strictly in
array order and stops at the first failure, returning
`{ results, stoppedAt, error: { message, code, kind } }` with the failing item's status.
Later items are not applied.

## Concerns

1. **Four kinds are adapters, not extracts** — `invoice.update`, `invoice.payment`,
   `payment.create`, `customer.upsert`/`customer.archive` and `stock.adjust` depend on
   `request` being present. Called without it they throw
   `REQUEST_CONTEXT_REQUIRED` (500) rather than doing anything silently. Turning them
   into true extracts is follow-up work.
2. **`invoice.create` offline numbering is untested against the invoice sequence.**
   `createInvoice` accepts `invoiceNumber` but, unlike `createSale`, does not
   duplicate-check it before insert; it relies on the existing unique constraint and the
   route's `P2002` → 409 mapping.
3. **`stock.adjust` requires an absolute `quantityInStock`.** The product route only
   accepts an absolute level, so a relative delta payload is rejected with
   `ABSOLUTE_QUANTITY_REQUIRED` instead of being guessed at.
4. **No integration test touches a database.** Everything proven here is unit-level plus
   an import smoke test; the extracts still need a run against a real tenant (POS sale,
   void, refund, invoice create/void) before release.
5. **`pos.cashDay.open` whitelists payload fields** (`businessDate`, `openingBalance`)
   rather than spreading the payload, so a queued item cannot override the service's
   `client` (Prisma) argument.

 RUN  v4.1.2 C:/laragon/www/insight-books-v2.5


 Test Files  2 passed (2)
      Tests  11 passed (11)
   Start at  03:54:51
   Duration  417ms (transform 113ms, setup 0ms, import 168ms, tests 17ms, environment 0ms)

