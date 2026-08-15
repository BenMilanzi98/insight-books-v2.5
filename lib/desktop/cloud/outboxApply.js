/**
 * Desktop outbox apply (cloud side).
 *
 * Every kind is applied by calling the SAME service/route code the web app uses.
 * Nothing here re-implements posting, numbering or stock math: handlers are thin
 * adapters over `lib/sales/*`, `lib/invoices/*`, `lib/payments/*` and the existing
 * client/stock routes, so there is exactly one accounting engine.
 *
 * Idempotency: `DesktopOutboxReceipt.id` is the client mutation id. A replayed id
 * returns the stored `resultJson` and never re-posts.
 */

export const DESKTOP_OUTBOX_KINDS = [
  'customer.upsert',
  'customer.archive',
  'stock.adjust',
  'invoice.create',
  'invoice.update',
  'invoice.void',
  'invoice.payment',
  'pos.sale',
  'pos.void',
  'pos.refund',
  'pos.cashDay.open',
  'pos.cashDay.close',
  'payment.create',
];

export function outboxError(message, { code, status = 400 } = {}) {
  const error = new Error(message);
  if (code) error.code = code;
  error.status = status;
  return error;
}

function requireRequest(ctx, kind) {
  if (!ctx.request) {
    throw outboxError(`Outbox kind "${kind}" needs the originating request context`, {
      code: 'REQUEST_CONTEXT_REQUIRED',
      status: 500,
    });
  }
  return ctx.request;
}

function serverIdFrom(result) {
  if (!result || typeof result !== 'object') return null;
  return result.id ?? result.serverId ?? result.serverEntityId ?? result.invoiceId ?? null;
}

/** Prisma `Json` columns reject Decimal/Date instances; keep a plain snapshot. */
function toJsonSafe(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return null;
  }
}

/**
 * Default handlers. Imports are lazy so unit tests (and the desktop client bundle)
 * never pull Prisma / Next server modules just to inspect the kind table.
 */
export const DEFAULT_OUTBOX_HANDLERS = {
  'pos.sale': async ({ user, payload, saleNumber }) => {
    const { createSale } = await import('../../sales/createSale.js');
    return createSale({ user, body: payload, saleNumber: saleNumber ?? payload?.saleNumber });
  },

  'pos.void': async ({ user, payload }) => {
    const { voidSale } = await import('../../sales/voidSale.js');
    return voidSale({ user, saleId: payload?.saleId, reason: payload?.reason });
  },

  'pos.refund': async ({ user, payload }) => {
    const { refundSale } = await import('../../sales/refundSale.js');
    return refundSale({ user, saleId: payload?.saleId, body: payload });
  },

  'pos.cashDay.open': async ({ tenantId, user, payload }) => {
    const { openPosCashDay } = await import('../../posCashDayService.js');
    // Whitelist: never let a queued payload override the prisma client argument.
    return openPosCashDay({
      tenantId,
      userId: user.id,
      businessDate: payload?.businessDate,
      openingBalance: payload?.openingBalance ?? payload?.openingFloat,
    });
  },

  'pos.cashDay.close': async ({ tenantId, user, payload }) => {
    const { closePosCashDayManual } = await import('../../posCashDayService.js');
    return closePosCashDayManual({
      tenantId,
      userId: user.id,
      businessDate: payload?.businessDate,
    });
  },

  'invoice.create': async ({ user, payload }) => {
    const { createInvoice } = await import('../../invoices/createInvoice.js');
    return createInvoice({
      user,
      body: payload,
      invoiceNumber: payload?.invoiceNumber,
    });
  },

  'invoice.update': async (ctx) => {
    const { updateInvoice } = await import('../../invoices/updateInvoice.js');
    return updateInvoice({
      request: requireRequest(ctx, 'invoice.update'),
      invoiceId: ctx.payload?.invoiceId ?? ctx.payload?.id,
      body: ctx.payload,
    });
  },

  'invoice.void': async ({ user, payload, request }) => {
    const { voidInvoice } = await import('../../invoices/voidInvoice.js');
    return voidInvoice({
      user,
      invoiceId: payload?.invoiceId ?? payload?.id,
      reason: payload?.reason,
      ipAddress:
        request?.headers?.get('x-forwarded-for') ||
        request?.headers?.get('x-real-ip') ||
        'desktop-outbox',
    });
  },

  'invoice.payment': async (ctx) => {
    const { recordInvoicePayment } = await import('../../invoices/recordInvoicePayment.js');
    return recordInvoicePayment({
      request: requireRequest(ctx, 'invoice.payment'),
      body: ctx.payload,
    });
  },

  'payment.create': async (ctx) => {
    const { createPayment } = await import('../../payments/createPayment.js');
    return createPayment({
      request: requireRequest(ctx, 'payment.create'),
      body: ctx.payload,
    });
  },

  'customer.upsert': async (ctx) => {
    const { upsertClient } = await import('../../clients/upsertClient.js');
    return upsertClient({
      request: requireRequest(ctx, 'customer.upsert'),
      body: ctx.payload,
    });
  },

  'customer.archive': async (ctx) => {
    const { archiveClient } = await import('../../clients/upsertClient.js');
    return archiveClient({
      request: requireRequest(ctx, 'customer.archive'),
      clientId: ctx.payload?.clientId ?? ctx.payload?.id,
    });
  },

  'stock.adjust': async (ctx) => {
    const { adjustStock } = await import('../../stock/adjustStock.js');
    return adjustStock({
      request: requireRequest(ctx, 'stock.adjust'),
      productId: ctx.payload?.productId ?? ctx.payload?.id,
      body: ctx.payload,
    });
  },
};

/**
 * Apply one outbox item exactly once.
 *
 * @returns {Promise<{ serverId: string | null, result: unknown, duplicate: boolean }>}
 */
export async function applyDesktopOutboxItem({
  prisma,
  tenantId,
  user,
  deviceId,
  item,
  handlers,
  request = null,
}) {
  if (!tenantId) throw outboxError('Tenant context required', { code: 'TENANT_REQUIRED' });
  if (!deviceId) throw outboxError('Device ID required', { code: 'DEVICE_REQUIRED' });
  if (!item?.id) throw outboxError('Outbox item id required', { code: 'ITEM_ID_REQUIRED' });

  const kind = item.kind;
  const table = handlers ? { ...DEFAULT_OUTBOX_HANDLERS, ...handlers } : DEFAULT_OUTBOX_HANDLERS;
  const handler = DESKTOP_OUTBOX_KINDS.includes(kind) ? table[kind] : undefined;
  if (typeof handler !== 'function') {
    throw outboxError(`Unsupported outbox kind: ${kind}`, { code: 'UNKNOWN_KIND' });
  }

  const existing = await prisma.desktopOutboxReceipt.findUnique({
    where: { tenantId_id: { tenantId, id: item.id } },
  });
  if (existing) {
    return {
      serverId: existing.serverEntityId ?? existing.resultJson?.serverId ?? null,
      result: existing.resultJson ?? null,
      duplicate: true,
    };
  }

  const result = await handler({
    prisma,
    tenantId,
    user,
    deviceId,
    item,
    kind,
    payload: item.payload ?? {},
    saleNumber: item.saleNumber ?? item.payload?.saleNumber ?? null,
    request,
  });

  const serverId = serverIdFrom(result);
  const resultJson = toJsonSafe(result) ?? {};
  if (serverId && resultJson && typeof resultJson === 'object' && !Array.isArray(resultJson)) {
    resultJson.serverId = serverId;
  }

  await prisma.desktopOutboxReceipt.create({
    data: {
      id: item.id,
      tenantId,
      deviceId,
      kind,
      serverEntityId: serverId,
      resultJson,
    },
  });

  return { serverId, result, duplicate: false };
}
