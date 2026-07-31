/**
 * PayChangu → PlatformInvoice + PlatformPayment ledger bridge.
 * Idempotent on callback replay. Does not touch Tenant AR Invoice/Payment.
 */

import {
  allocatePayment,
  buildRenewalInvoiceRequest,
  paymentIdempotencyKey,
} from './platformBilling.js';

function toIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Build a PAID platform invoice spec for a successful PayChangu activation.
 */
export function buildPaychanguPaidInvoiceSpec({
  tenantId,
  subscriptionId,
  periodStart,
  periodEnd,
  amount,
  currency = 'MWK',
  planCode,
}) {
  const start = toIso(periodStart);
  const end = toIso(periodEnd);
  const built = buildRenewalInvoiceRequest({
    tenantId,
    subscriptionId,
    periodStart: start,
    periodEnd: end,
    currency,
    subtotal: amount,
    discount: 0,
    tax: 0,
    planCode,
  });
  if (!built.ok) return built;

  const total = built.body.total;
  return {
    ok: true,
    invoice: {
      ...built.body,
      status: 'PAID',
      amountPaid: total,
      outstanding: 0,
    },
  };
}

async function ensureInvoice(prisma, invoiceSpec) {
  if (typeof prisma.platformInvoice?.findUnique !== 'function') {
    return { invoice: null, created: false, error: 'platformInvoice unavailable' };
  }

  const existing = await prisma.platformInvoice.findUnique({
    where: { idempotencyKey: invoiceSpec.idempotencyKey },
  });
  if (existing) return { invoice: existing, created: false };

  try {
    const invoice = await prisma.platformInvoice.create({
      data: {
        invoiceNumber: `PI-PC-${Date.now().toString(36).toUpperCase()}`,
        tenantId: invoiceSpec.tenantId,
        subscriptionId: invoiceSpec.subscriptionId,
        periodStart: invoiceSpec.periodStart ? new Date(invoiceSpec.periodStart) : null,
        periodEnd: invoiceSpec.periodEnd ? new Date(invoiceSpec.periodEnd) : null,
        currency: invoiceSpec.currency || 'MWK',
        subtotal: invoiceSpec.subtotal,
        discount: invoiceSpec.discount || 0,
        tax: invoiceSpec.tax || 0,
        total: invoiceSpec.total,
        amountPaid: invoiceSpec.amountPaid ?? 0,
        outstanding: invoiceSpec.outstanding ?? invoiceSpec.total,
        status: invoiceSpec.status || 'ISSUED',
        idempotencyKey: invoiceSpec.idempotencyKey,
      },
    });
    return { invoice, created: true };
  } catch (e) {
    if (e?.code === 'P2002') {
      const invoice = await prisma.platformInvoice.findUnique({
        where: { idempotencyKey: invoiceSpec.idempotencyKey },
      });
      return { invoice, created: false };
    }
    throw e;
  }
}

async function ensurePayment(prisma, {
  tenantId,
  invoiceId,
  amount,
  currency,
  gatewayReference,
  method,
}) {
  if (typeof prisma.platformPayment?.findUnique !== 'function') {
    return { payment: null, created: false, error: 'platformPayment unavailable' };
  }

  const idempotencyKey = paymentIdempotencyKey({
    gateway: 'PayChangu',
    gatewayReference,
  });
  if (!idempotencyKey) {
    return { payment: null, created: false, error: 'gatewayReference required' };
  }

  const existing = await prisma.platformPayment.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    if (invoiceId && !existing.invoiceId && typeof prisma.platformPayment.update === 'function') {
      const payment = await prisma.platformPayment.update({
        where: { id: existing.id },
        data: { invoiceId, status: 'COMPLETED' },
      });
      return { payment, created: false, linked: true };
    }
    return { payment: existing, created: false, linked: false };
  }

  try {
    const payment = await prisma.platformPayment.create({
      data: {
        paymentNumber: `PP-PC-${Date.now().toString(36).toUpperCase()}`,
        tenantId,
        invoiceId: invoiceId || null,
        currency: currency || 'MWK',
        amount,
        method: method || 'PayChangu',
        gateway: 'PayChangu',
        gatewayReference,
        status: 'COMPLETED',
        idempotencyKey,
      },
    });
    return { payment, created: true, linked: Boolean(invoiceId) };
  } catch (e) {
    if (e?.code === 'P2002') {
      const payment = await prisma.platformPayment.findUnique({
        where: { idempotencyKey },
      });
      return { payment, created: false, linked: false };
    }
    throw e;
  }
}

/**
 * Create (or reuse) PlatformInvoice + PlatformPayment for a verified PayChangu success.
 * Safe on callback replay.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function ensurePaychanguPlatformLedger(prisma, input = {}) {
  const {
    tenantId,
    subscriptionId,
    periodStart,
    periodEnd,
    amount,
    currency = 'MWK',
    planCode,
    gatewayReference,
    method = 'PayChangu',
  } = input;

  const spec = buildPaychanguPaidInvoiceSpec({
    tenantId,
    subscriptionId,
    periodStart,
    periodEnd,
    amount,
    currency,
    planCode,
  });
  if (!spec.ok) {
    return { ok: false, error: spec.error || 'Invalid invoice spec' };
  }
  if (!gatewayReference) {
    return { ok: false, error: 'gatewayReference is required' };
  }

  try {
    const { invoice, created: createdInvoice, error: invErr } = await ensureInvoice(
      prisma,
      spec.invoice
    );
    if (!invoice) {
      return { ok: false, error: invErr || 'Failed to ensure platform invoice' };
    }

    const {
      payment,
      created: createdPayment,
      error: payErr,
    } = await ensurePayment(prisma, {
      tenantId,
      invoiceId: invoice.id,
      amount: Number(amount),
      currency,
      gatewayReference,
      method,
    });
    if (!payment) {
      return {
        ok: false,
        error: payErr || 'Failed to ensure platform payment',
        invoice,
        createdInvoice,
      };
    }

    // Keep invoice paid state consistent with completed payment allocation
    const outstanding = Number(invoice.outstanding);
    const amountPaid = Number(invoice.amountPaid);
    const total = Number(invoice.total);
    if (
      invoice.status !== 'PAID' ||
      amountPaid < total ||
      outstanding > 0
    ) {
      const alloc = allocatePayment({
        invoiceOutstanding: Math.max(outstanding, total - amountPaid),
        paymentAmount: Number(amount),
      });
      if (alloc.ok && typeof prisma.platformInvoice?.update === 'function') {
        const nextPaid = Math.min(total, amountPaid + alloc.applied);
        const nextOutstanding = Math.max(0, total - nextPaid);
        await prisma.platformInvoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: nextPaid,
            outstanding: nextOutstanding,
            status: nextOutstanding === 0 ? 'PAID' : alloc.invoiceStatus,
          },
        });
        invoice.amountPaid = nextPaid;
        invoice.outstanding = nextOutstanding;
        invoice.status = nextOutstanding === 0 ? 'PAID' : alloc.invoiceStatus;
      }
    }

    try {
      const { emitPlatformLedgerEvents } = await import('@/lib/admin/analytics/emit');
      await emitPlatformLedgerEvents(prisma, {
        invoice,
        payment,
        createdInvoice,
        createdPayment,
      });
    } catch (emitErr) {
      console.warn('[paychanguPlatformLedger] analytics emit skipped:', emitErr?.message || emitErr);
    }

    return {
      ok: true,
      invoice,
      payment,
      createdInvoice,
      createdPayment,
    };
  } catch (e) {
    console.warn('[paychanguPlatformLedger]', e?.message || e);
    return { ok: false, error: e?.message || 'Ledger write failed' };
  }
}
