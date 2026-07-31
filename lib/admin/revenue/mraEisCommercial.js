/**
 * MRA EIS commercial analytics — contracted MRR split + payments/invoices
 * attributable when plan is known via AccountSubscription.
 * Entitlement counts are NOT revenue (executive pack owns those).
 */

import { categoryForPlanCode, PLAN_CATEGORY } from '@/lib/admin/mraEisPlans';
import { loadPointInTimeMrr } from './reconstructMrr.js';
import {
  SUCCESSFUL_PAYMENT_STATUSES,
  VOID_INVOICE_STATUSES,
  roundMoney,
  parseCurrencyOpt,
} from './billingConstants.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ periodStart: Date, periodEnd?: Date, currency?: string, now?: Date }} opts
 */
export async function computeMraEisCommercial(prisma, opts = {}) {
  const { isCrossCurrency, defaultCurrency } = parseCurrencyOpt(opts.currency);
  const now = opts.now || new Date();
  const periodStart = opts.periodStart;
  const periodEnd = opts.periodEnd || now;

  if (isCrossCurrency) {
    return {
      ok: false,
      reasonCode: 'fx_unavailable',
      message:
        'Cross-currency consolidation UNAVAILABLE without a certified FX rate source; request a single currency.',
      currency: 'ALL',
    };
  }

  if (!periodStart) {
    return {
      ok: false,
      reasonCode: 'incomplete',
      message: 'periodStart required',
      currency: defaultCurrency,
    };
  }

  try {
    const pit = await loadPointInTimeMrr(prisma, {
      currency: defaultCurrency,
      now,
    });

    let billedPeriod = 0;
    let collectedPeriod = 0;
    let invoicesAttributed = 0;
    let invoicesSkippedUnknownPlan = 0;
    let paymentsAttributed = 0;
    let paymentsSkippedUnknownPlan = 0;

    if (typeof prisma?.platformInvoice?.findMany === 'function') {
      const invoices = await prisma.platformInvoice.findMany({
        where: {
          currency: defaultCurrency,
          createdAt: { gte: periodStart, lte: periodEnd },
          status: { notIn: [...VOID_INVOICE_STATUSES] },
        },
        select: {
          id: true,
          total: true,
          subscriptionId: true,
        },
      });

      const subIds = [
        ...new Set(
          (invoices || []).map((i) => i.subscriptionId).filter(Boolean)
        ),
      ];
      const subMap = new Map();
      if (subIds.length && typeof prisma?.accountSubscription?.findMany === 'function') {
        const subs = await prisma.accountSubscription.findMany({
          where: { id: { in: subIds } },
          select: { id: true, plan: true },
        });
        for (const s of subs || []) subMap.set(s.id, s.plan);
      }

      for (const inv of invoices || []) {
        const plan = inv.subscriptionId ? subMap.get(inv.subscriptionId) : null;
        if (!plan) {
          invoicesSkippedUnknownPlan += 1;
          continue;
        }
        if (categoryForPlanCode(plan) !== PLAN_CATEGORY.MRA_EIS) continue;
        billedPeriod += Number(inv.total) || 0;
        invoicesAttributed += 1;
      }
    }

    if (typeof prisma?.platformPayment?.findMany === 'function') {
      const payments = await prisma.platformPayment.findMany({
        where: {
          currency: defaultCurrency,
          status: { in: [...SUCCESSFUL_PAYMENT_STATUSES] },
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        select: {
          id: true,
          amount: true,
          invoiceId: true,
        },
      });

      const invoiceIds = [
        ...new Set(
          (payments || []).map((p) => p.invoiceId).filter(Boolean)
        ),
      ];
      const invSubMap = new Map();
      if (
        invoiceIds.length &&
        typeof prisma?.platformInvoice?.findMany === 'function'
      ) {
        const invs = await prisma.platformInvoice.findMany({
          where: { id: { in: invoiceIds } },
          select: { id: true, subscriptionId: true },
        });
        const subIds = [
          ...new Set(invs.map((i) => i.subscriptionId).filter(Boolean)),
        ];
        const subMap = new Map();
        if (
          subIds.length &&
          typeof prisma?.accountSubscription?.findMany === 'function'
        ) {
          const subs = await prisma.accountSubscription.findMany({
            where: { id: { in: subIds } },
            select: { id: true, plan: true },
          });
          for (const s of subs || []) subMap.set(s.id, s.plan);
        }
        for (const inv of invs) {
          invSubMap.set(
            inv.id,
            inv.subscriptionId ? subMap.get(inv.subscriptionId) || null : null
          );
        }
      }

      for (const pay of payments || []) {
        if (!pay.invoiceId) {
          paymentsSkippedUnknownPlan += 1;
          continue;
        }
        const plan = invSubMap.get(pay.invoiceId);
        if (!plan) {
          paymentsSkippedUnknownPlan += 1;
          continue;
        }
        if (categoryForPlanCode(plan) !== PLAN_CATEGORY.MRA_EIS) continue;
        collectedPeriod += Number(pay.amount) || 0;
        paymentsAttributed += 1;
      }
    }

    return {
      ok: true,
      currency: defaultCurrency,
      mrrEstimated: Number(pit.mraEis) || 0,
      mrrEstimatedTotal: Number(pit.total) || 0,
      billedPeriod: roundMoney(billedPeriod),
      collectedPeriod: roundMoney(collectedPeriod),
      invoicesAttributed,
      invoicesSkippedUnknownPlan,
      paymentsAttributed,
      paymentsSkippedUnknownPlan,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      limitations:
        'Commercial MRA EIS only (planCategory/plan code). Invoices/payments without known subscription plan are excluded — not counted as zero revenue. Entitlement counts are not revenue.',
    };
  } catch (e) {
    return {
      ok: false,
      reasonCode: 'query_failed',
      message: e?.message || 'MRA EIS commercial query failed',
      currency: defaultCurrency,
    };
  }
}
