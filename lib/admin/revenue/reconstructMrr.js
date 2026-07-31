/**

 * Best-effort historical estimated MRR reconstruction from AccountSubscription.

 * Gaps / low confidence → never invent bridge-ready numbers.

 */



import {

  normalizeAmountToMrr,

  activePaidSubscriptionWhere,

  INACTIVE_STATUSES,

} from '@/lib/admin/saasBillingKpis';

import { categoryForPlanCode, PLAN_CATEGORY } from '@/lib/admin/mraEisPlans';



const INACTIVE_STATUS_SET = new Set(INACTIVE_STATUSES);



export function startOfUtcDay(d) {

  const x = d instanceof Date ? d : new Date(d);

  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));

}



export function dayKeyUtc(d) {

  return startOfUtcDay(d).toISOString().slice(0, 10);

}



function eachUtcDay(from, to) {

  const days = [];

  let cur = startOfUtcDay(from);

  const end = startOfUtcDay(to);

  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime()) || cur > end) {

    return days;

  }

  while (cur.getTime() <= end.getTime()) {

    days.push(new Date(cur));

    cur = new Date(cur.getTime() + 864e5);

  }

  return days;

}



export function accessStartAt(row) {

  return row?.startedAt || row?.paymentDate || row?.createdAt || null;

}



/**

 * Commercial access covers calendar day D: start ≤ D < expiresAt (UTC day bounds).

 */

export function subscriptionCoversDay(row, day) {

  const start = accessStartAt(row);

  if (!start || !row?.expiresAt) return false;

  const dayStart = startOfUtcDay(day);

  const dayEnd = new Date(dayStart.getTime() + 864e5 - 1);

  const startAt = start instanceof Date ? start : new Date(start);

  const expAt = row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(expAt.getTime())) return false;

  if (startAt.getTime() > dayEnd.getTime()) return false;

  if (expAt.getTime() <= dayStart.getTime()) return false;

  return true;

}



function roundMoney(n) {

  return Math.round(Number(n) * 100) / 100;

}



function isInactiveStatus(status) {

  return INACTIVE_STATUS_SET.has(String(status || ''));

}



/** Historical reconstruct where — no isActive; coverage + paid non-trial + non-inactive status. */

function historicalSubscriptionWhere({ currency, rangeStart, rangeEnd, caseInsensitive }) {

  const base = {

    isTrial: false,

    status: { notIn: [...INACTIVE_STATUSES] },

    OR: [

      { startedAt: { lte: rangeEnd } },

      { paymentDate: { lte: rangeEnd } },

      { createdAt: { lte: rangeEnd } },

    ],

    expiresAt: { gt: rangeStart },

  };

  if (caseInsensitive) {

    return { ...base, currency: { equals: currency, mode: 'insensitive' } };

  }

  return { ...base, currency };

}



const SUBSCRIPTION_SELECT = {

  id: true,

  tenantId: true,

  plan: true,

  amount: true,

  currency: true,

  status: true,

  isActive: true,

  isTrial: true,

  startedAt: true,

  paymentDate: true,

  createdAt: true,

  expiresAt: true,

};



/**

 * Point-in-time estimated MRR for a currency from live active paid rows.

 * @returns {{ total, core, mraEis, bySubscription, tenantIds, rowCount, currency }}

 */

export function summarizeActiveMrr(rows, currency) {

  const ccy = String(currency || '').toUpperCase();

  const bySubscription = {};

  const tenantIds = new Set();

  let total = 0;

  let core = 0;

  let mraEis = 0;

  let rowCount = 0;



  for (const row of rows || []) {

    const rowCcy = String(row.currency || 'MWK').toUpperCase();

    if (ccy && rowCcy !== ccy) continue;

    const mrr = normalizeAmountToMrr(row.amount, row.plan);

    if (!(mrr > 0)) continue;

    const category = categoryForPlanCode(row.plan);

    bySubscription[row.id] = {

      mrr: roundMoney(mrr),

      category,

      tenantId: row.tenantId,

      plan: row.plan,

      currency: rowCcy,

    };

    tenantIds.add(row.tenantId);

    total += mrr;

    if (category === PLAN_CATEGORY.MRA_EIS) mraEis += mrr;

    else core += mrr;

    rowCount += 1;

  }



  return {

    total: roundMoney(total),

    core: roundMoney(core),

    mraEis: roundMoney(mraEis),

    bySubscription,

    tenantIds,

    rowCount,

    currency: ccy || null,

  };

}



/**

 * Reconstruct daily estimated MRR for [from, to] in a single currency.

 *

 * Historical: includes churned (isActive=false) rows that covered day D.

 * Live/current point-in-time uses loadPointInTimeMrr (isActive:true).

 *

 * @param {import('@prisma/client').PrismaClient} prisma

 * @param {{ from: Date|string, to: Date|string, currency: string }} opts

 * @returns {Promise<{ days: object[], confidence: string, gaps: object[], currency: string|null }>}

 */

export async function reconstructMrrHistory(prisma, opts = {}) {

  const currency = opts.currency ? String(opts.currency).toUpperCase() : null;

  if (!currency || currency === 'ALL' || currency === '*') {

    return {

      days: [],

      confidence: 'UNAVAILABLE',

      gaps: [

        {

          reason: 'cross_currency_or_missing_currency',

          message:

            'Per-currency reconstruction required; cross-currency totals are UNAVAILABLE without FX.',

        },

      ],

      currency: null,

    };

  }



  const from = opts.from ? new Date(opts.from) : null;

  const to = opts.to ? new Date(opts.to) : null;

  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {

    return {

      days: [],

      confidence: 'UNAVAILABLE',

      gaps: [{ reason: 'invalid_range', message: 'from/to dates are required' }],

      currency,

    };

  }



  const dayList = eachUtcDay(from, to);

  if (!dayList.length) {

    return {

      days: [],

      confidence: 'UNAVAILABLE',

      gaps: [{ reason: 'empty_range', message: 'No days in range' }],

      currency,

    };

  }



  const rangeStart = dayList[0];

  const rangeEnd = new Date(dayList[dayList.length - 1].getTime() + 864e5);



  let rows = [];

  try {

    rows = await prisma.accountSubscription.findMany({

      where: historicalSubscriptionWhere({

        currency,

        rangeStart,

        rangeEnd,

        caseInsensitive: true,

      }),

      select: SUBSCRIPTION_SELECT,

    });

  } catch (e) {

    // Some DBs lack case-insensitive mode — retry without mode

    try {

      rows = await prisma.accountSubscription.findMany({

        where: historicalSubscriptionWhere({

          currency,

          rangeStart,

          rangeEnd,

          caseInsensitive: false,

        }),

        select: SUBSCRIPTION_SELECT,

      });

    } catch (err) {

      return {

        days: [],

        confidence: 'UNAVAILABLE',

        gaps: [

          {

            reason: 'query_failed',

            message: err?.message || e?.message || 'Subscription query failed',

          },

        ],

        currency,

      };

    }

  }



  // Filter currency / trial / inactive status in JS (handles mixed casing when mode unsupported).

  // Do NOT require isActive — churned rows must still contribute on days they covered.

  rows = (rows || []).filter(

    (r) =>

      String(r.currency || '').toUpperCase() === currency &&

      !r.isTrial &&

      !isInactiveStatus(r.status)

  );



  const days = [];

  const gaps = [];

  let anyLow = false;

  let anyHigh = false;



  for (const day of dayList) {

    const bySubscription = {};

    let total = 0;

    let core = 0;

    let mraEis = 0;

    let missingStart = 0;

    let conflictingStatus = 0;

    let coveredInactive = 0;

    let unconfidentCoverage = 0;



    for (const row of rows) {

      const start = accessStartAt(row);

      const hasStartedAt = Boolean(row.startedAt);

      const inactive = isInactiveStatus(row.status);



      // Cannot confidently place this row on a day without start + expiry bounds.

      if (!start || !row.expiresAt) {

        if (!hasStartedAt && row.expiresAt) missingStart += 1;

        else unconfidentCoverage += 1;

        continue;

      }



      const covers = subscriptionCoversDay(row, day);

      if (!covers) continue;



      if (!hasStartedAt) missingStart += 1;



      if (inactive) {

        coveredInactive += 1;

        conflictingStatus += 1;

        continue;

      }



      const mrr = normalizeAmountToMrr(row.amount, row.plan);

      if (!(mrr > 0)) continue;

      const category = categoryForPlanCode(row.plan);

      bySubscription[row.id] = {

        mrr: roundMoney(mrr),

        category,

        tenantId: row.tenantId,

        plan: row.plan,

        currency,

      };

      total += mrr;

      if (category === PLAN_CATEGORY.MRA_EIS) mraEis += mrr;

      else core += mrr;

    }



    const lowConfidence =

      missingStart > 0 || conflictingStatus > 0 || unconfidentCoverage > 0;

    if (lowConfidence) {

      anyLow = true;

      gaps.push({

        date: dayKeyUtc(day),

        reason: 'low_confidence',

        missingStartFields: missingStart,

        conflictingStatus,

        coveredInactive,

        unconfidentCoverage,

      });

    } else {

      anyHigh = true;

    }



    days.push({

      date: dayKeyUtc(day),

      snapshotDate: startOfUtcDay(day),

      currency,

      total: roundMoney(total),

      core: roundMoney(core),

      mraEis: roundMoney(mraEis),

      bySubscription,

      confidence: lowConfidence ? 'LOW_CONFIDENCE' : 'HIGH',

      rowCount: Object.keys(bySubscription).length,

    });

  }



  let confidence = 'HIGH';

  if (!days.length) confidence = 'UNAVAILABLE';

  else if (anyLow && !anyHigh) confidence = 'LOW_CONFIDENCE';

  else if (anyLow) confidence = 'MIXED';



  return { days, confidence, gaps, currency };

}



/**

 * Live point-in-time active paid MRR for currency (uses saasBillingKpis where-clause).

 */

export async function loadPointInTimeMrr(prisma, { currency, now = new Date() } = {}) {

  const ccy = currency ? String(currency).toUpperCase() : 'MWK';

  const rows = await prisma.accountSubscription.findMany({

    where: activePaidSubscriptionWhere(now),

    select: {

      id: true,

      tenantId: true,

      plan: true,

      amount: true,

      currency: true,

      status: true,

    },

  });

  return summarizeActiveMrr(rows, ccy);

}


