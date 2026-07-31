/**
 * Platform SaaS receivable ageing from PlatformInvoice outstanding.
 *
 * Due-date field choice (documented):
 * - PlatformInvoice has **no dueDate** column in Prisma.
 * - Prefer `periodEnd` when present; otherwise fall back to `createdAt`.
 * - Ageing is as-of `now` (UTC day difference).
 */

import {
  VOID_INVOICE_STATUSES,
  roundMoney,
  parseCurrencyOpt,
} from './billingConstants.js';

export const AGEING_DUE_FIELD_DOC =
  'PlatformInvoice has no dueDate; ageing uses periodEnd when set, else createdAt.';

/**
 * @param {{ periodEnd?: Date|string|null, createdAt?: Date|string|null }} invoice
 * @returns {Date|null}
 */
export function invoiceDueReference(invoice) {
  if (!invoice) return null;
  if (invoice.periodEnd) return new Date(invoice.periodEnd);
  if (invoice.createdAt) return new Date(invoice.createdAt);
  return null;
}

function daysPastDue(due, now) {
  const ms = now.getTime() - due.getTime();
  return Math.floor(ms / 864e5);
}

function emptyBuckets() {
  return {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    d90_plus: 0,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ currency?: string, now?: Date }} opts
 */
export async function computeReceivablesAgeing(prisma, opts = {}) {
  const { isCrossCurrency, defaultCurrency } = parseCurrencyOpt(opts.currency);
  const now = opts.now || new Date();

  if (isCrossCurrency) {
    return {
      ok: false,
      reasonCode: 'fx_unavailable',
      message:
        'Cross-currency consolidation UNAVAILABLE without a certified FX rate source; request a single currency.',
      currency: 'ALL',
      buckets: null,
      outstandingTotal: null,
      dueFieldDoc: AGEING_DUE_FIELD_DOC,
    };
  }

  if (typeof prisma?.platformInvoice?.findMany !== 'function') {
    return {
      ok: false,
      reasonCode: 'query_failed',
      message: 'PlatformInvoice model unavailable',
      currency: defaultCurrency,
      buckets: null,
      outstandingTotal: null,
      dueFieldDoc: AGEING_DUE_FIELD_DOC,
    };
  }

  try {
    const rows = await prisma.platformInvoice.findMany({
      where: {
        currency: defaultCurrency,
        outstanding: { gt: 0 },
        status: { notIn: [...VOID_INVOICE_STATUSES] },
      },
      select: {
        id: true,
        outstanding: true,
        periodEnd: true,
        createdAt: true,
        status: true,
        currency: true,
      },
    });

    const buckets = emptyBuckets();
    let outstandingTotal = 0;

    for (const row of rows || []) {
      if (row.outstanding == null) {
        return {
          ok: false,
          reasonCode: 'incomplete_outstanding',
          message:
            'Invoice outstanding is null/incomplete; ageing UNAVAILABLE (not false zero).',
          currency: defaultCurrency,
          buckets: null,
          outstandingTotal: null,
          dueFieldDoc: AGEING_DUE_FIELD_DOC,
        };
      }
      const amt = Number(row.outstanding);
      if (!Number.isFinite(amt)) {
        return {
          ok: false,
          reasonCode: 'incomplete_outstanding',
          message:
            'Invoice outstanding is non-numeric; ageing UNAVAILABLE (not false zero).',
          currency: defaultCurrency,
          buckets: null,
          outstandingTotal: null,
          dueFieldDoc: AGEING_DUE_FIELD_DOC,
        };
      }
      if (amt < 0) {
        return {
          ok: false,
          reasonCode: 'incomplete_outstanding',
          message: 'Negative outstanding rejected; ageing UNAVAILABLE.',
          currency: defaultCurrency,
          buckets: null,
          outstandingTotal: null,
          dueFieldDoc: AGEING_DUE_FIELD_DOC,
        };
      }

      const due = invoiceDueReference(row);
      if (!due || Number.isNaN(due.getTime())) {
        return {
          ok: false,
          reasonCode: 'incomplete_due_reference',
          message:
            'Missing periodEnd and createdAt for ageing; UNAVAILABLE (not false zero).',
          currency: defaultCurrency,
          buckets: null,
          outstandingTotal: null,
          dueFieldDoc: AGEING_DUE_FIELD_DOC,
        };
      }

      const days = daysPastDue(due, now);
      outstandingTotal += amt;
      if (days <= 0) buckets.current += amt;
      else if (days <= 30) buckets.d1_30 += amt;
      else if (days <= 60) buckets.d31_60 += amt;
      else if (days <= 90) buckets.d61_90 += amt;
      else buckets.d90_plus += amt;
    }

    for (const key of Object.keys(buckets)) {
      buckets[key] = roundMoney(buckets[key]);
    }

    return {
      ok: true,
      currency: defaultCurrency,
      buckets,
      outstandingTotal: roundMoney(outstandingTotal),
      invoiceCount: (rows || []).length,
      asOf: now.toISOString(),
      dueFieldDoc: AGEING_DUE_FIELD_DOC,
      limitations: AGEING_DUE_FIELD_DOC,
    };
  } catch (e) {
    return {
      ok: false,
      reasonCode: 'query_failed',
      message: e?.message || 'Receivables ageing query failed',
      currency: defaultCurrency,
      buckets: null,
      outstandingTotal: null,
      dueFieldDoc: AGEING_DUE_FIELD_DOC,
    };
  }
}
