/**
 * Revenue concentration — top tenants by estimated MRR + Herfindahl / top-N share.
 * Platform AccountSubscription only. Mask tenant names without tenants.view.
 */

import {
  normalizeAmountToMrr,
  activePaidSubscriptionWhere,
} from '@/lib/admin/saasBillingKpis';
import { roundMoney, parseCurrencyOpt } from './billingConstants.js';

/**
 * Herfindahl–Hirschman Index from share fractions (0–1).
 * @param {number[]} shares
 */
export function herfindahlIndex(shares) {
  let hhi = 0;
  for (const s of shares || []) {
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) continue;
    hhi += n * n;
  }
  return roundMoney(hhi * 10000) / 10000;
}

/**
 * @param {Array<{ tenantId: string, mrr: number }>} tenantRows
 * @param {number} [topN=10]
 */
export function rankTenantConcentration(tenantRows, topN = 10) {
  const sorted = [...(tenantRows || [])].sort((a, b) => b.mrr - a.mrr);
  const total = sorted.reduce((acc, r) => acc + (Number(r.mrr) || 0), 0);
  if (!(total > 0)) {
    return {
      totalMrr: 0,
      top: [],
      topNShare: null,
      hhi: null,
      tenantCount: 0,
    };
  }
  const n = Math.max(1, topN);
  const top = sorted.slice(0, n).map((r, i) => ({
    rank: i + 1,
    tenantId: r.tenantId,
    mrr: roundMoney(r.mrr),
    share: roundMoney(r.mrr / total),
  }));
  const topSum = top.reduce((acc, r) => acc + r.mrr, 0);
  const allShares = sorted.map((r) => r.mrr / total);
  return {
    totalMrr: roundMoney(total),
    top,
    topNShare: roundMoney(topSum / total),
    hhi: herfindahlIndex(allShares),
    tenantCount: sorted.length,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   currency?: string,
 *   now?: Date,
 *   topN?: number,
 *   canViewTenantNames?: boolean,
 * }} [opts]
 */
export async function computeConcentration(prisma, opts = {}) {
  const now = opts.now || new Date();
  const topN = Math.min(Math.max(Number(opts.topN) || 10, 1), 50);
  const canViewNames = Boolean(opts.canViewTenantNames);
  const { isCrossCurrency, defaultCurrency } = parseCurrencyOpt(opts.currency);

  if (isCrossCurrency) {
    return {
      ok: false,
      reasonCode: 'fx_unavailable',
      message:
        'Cross-currency concentration UNAVAILABLE without a certified FX rate source; request a single currency.',
      currency: null,
      ranking: null,
      topContributors: null,
    };
  }

  const currency = defaultCurrency;

  let rows = [];
  try {
    rows = await prisma.accountSubscription.findMany({
      where: activePaidSubscriptionWhere(now),
      select: {
        id: true,
        tenantId: true,
        plan: true,
        amount: true,
        currency: true,
      },
    });
  } catch (e) {
    return {
      ok: false,
      reasonCode: 'query_failed',
      message: e?.message || 'Subscription query failed',
      currency,
      ranking: null,
      topContributors: null,
    };
  }

  const byTenant = new Map();
  for (const row of rows || []) {
    if (String(row.currency || 'MWK').toUpperCase() !== currency) continue;
    if (!row.tenantId) continue;
    const mrr = normalizeAmountToMrr(row.amount, row.plan);
    if (!(mrr > 0)) continue;
    byTenant.set(row.tenantId, (byTenant.get(row.tenantId) || 0) + mrr);
  }

  const tenantRows = [...byTenant.entries()].map(([tenantId, mrr]) => ({
    tenantId,
    mrr: roundMoney(mrr),
  }));

  const ranking = rankTenantConcentration(tenantRows, topN);

  // Optionally resolve names when permitted
  let nameById = {};
  if (canViewNames && ranking.top.length && typeof prisma.tenant?.findMany === 'function') {
    try {
      const tenants = await prisma.tenant.findMany({
        where: { id: { in: ranking.top.map((t) => t.tenantId) } },
        select: { id: true, name: true },
      });
      for (const t of tenants || []) {
        nameById[t.id] = t.name || null;
      }
    } catch {
      nameById = {};
    }
  }

  const topContributors = ranking.top.map((t) => {
    const rawName = nameById[t.tenantId];
    const label =
      canViewNames && rawName
        ? rawName
        : canViewNames
          ? t.tenantId
          : `tenant_${String(t.tenantId).slice(0, 8)}…`;
    return {
      ...t,
      label,
      masked: !canViewNames,
      name: canViewNames ? rawName || null : null,
    };
  });

  return {
    ok: true,
    reasonCode: null,
    message: null,
    currency,
    topN,
    ranking: {
      totalMrr: ranking.totalMrr,
      topNShare: ranking.topNShare,
      hhi: ranking.hhi,
      tenantCount: ranking.tenantCount,
    },
    topContributors,
    limitations:
      'Top tenants by estimated contracted MRR (active paid AccountSubscription). Names masked without tenants.view.',
  };
}
