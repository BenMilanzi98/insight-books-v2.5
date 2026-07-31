/**

 * Persist / read estimated MRR daily snapshots on AnalyticsDailySnapshot.

 *

 * metricKey family (per currency):

 *   mrr_estimated_total_<CCY>

 *   mrr_estimated_core_<CCY>

 *   mrr_estimated_mra_eis_<CCY>

 */



import { startOfUtcDay, dayKeyUtc } from './reconstructMrr.js';



/** Platform-level aggregate snapshots use empty tenantId. */

export const PLATFORM_SNAPSHOT_TENANT_ID = '';



export function mrrMetricKeys(currency) {

  const ccy = String(currency || 'MWK').toUpperCase();

  return {

    total: `mrr_estimated_total_${ccy}`,

    core: `mrr_estimated_core_${ccy}`,

    mraEis: `mrr_estimated_mra_eis_${ccy}`,

    currency: ccy,

  };

}



function roundMoney(n) {

  return Math.round(Number(n) * 100) / 100;

}



function moneyOrNull(v) {

  if (v == null || v === undefined) return null;

  const n = Number(v);

  if (!Number.isFinite(n)) return null;

  return roundMoney(n);

}



function existingConfidence(row) {

  const vj = row?.valueJson;

  if (vj && typeof vj === 'object' && vj.confidence) return String(vj.confidence);

  return null;

}



function isProtectedConfidence(conf) {

  return conf === 'HIGH' || conf === 'OK';

}



/**

 * Persist reconstruct result days into AnalyticsDailySnapshot (idempotent upsert).

 * Does not overwrite existing HIGH/OK confidence with LOW_CONFIDENCE unless force:true.

 *

 * @param {import('@prisma/client').PrismaClient} prisma

 * @param {{ days?: object[], currency?: string }} reconstructResult

 * @param {{ force?: boolean }} [opts]

 */

export async function persistMrrSnapshots(prisma, reconstructResult = {}, opts = {}) {

  const days = reconstructResult.days || [];

  const force = Boolean(opts.force);

  let written = 0;

  let skipped = 0;



  if (!prisma?.analyticsDailySnapshot?.upsert) {

    return { written: 0, skipped: days.length, error: 'analyticsDailySnapshot unavailable' };

  }



  for (const day of days) {

    const currency = day.currency || reconstructResult.currency;

    if (!currency || day.total == null) {

      skipped += 1;

      continue;

    }

    const keys = mrrMetricKeys(currency);

    const snapshotDate = startOfUtcDay(day.snapshotDate || day.date);

    const valueJson = {

      total: roundMoney(day.total),

      core: roundMoney(day.core),

      mraEis: roundMoney(day.mraEis),

      currency: keys.currency,

      confidence: day.confidence || 'UNKNOWN',

      bySubscription: day.bySubscription || {},

      rowCount: day.rowCount ?? Object.keys(day.bySubscription || {}).length,

      source: 'reconstruct_mrr',

    };



    const triples = [

      { metricKey: keys.total, valueNumeric: valueJson.total },

      { metricKey: keys.core, valueNumeric: valueJson.core },

      { metricKey: keys.mraEis, valueNumeric: valueJson.mraEis },

    ];



    for (const t of triples) {

      const where = {

        snapshotDate_metricKey_tenantId: {

          snapshotDate,

          metricKey: t.metricKey,

          tenantId: PLATFORM_SNAPSHOT_TENANT_ID,

        },

      };



      if (!force && valueJson.confidence === 'LOW_CONFIDENCE') {

        try {

          const existing = prisma.analyticsDailySnapshot.findUnique

            ? await prisma.analyticsDailySnapshot.findUnique({ where })

            : null;

          const prev = existingConfidence(existing);

          if (existing && isProtectedConfidence(prev)) {

            skipped += 1;

            continue;

          }

        } catch {

          // proceed to upsert if read fails

        }

      }



      await prisma.analyticsDailySnapshot.upsert({

        where,

        create: {

          snapshotDate,

          metricKey: t.metricKey,

          tenantId: PLATFORM_SNAPSHOT_TENANT_ID,

          valueNumeric: t.valueNumeric,

          valueJson,

          rebuiltAt: new Date(),

        },

        update: {

          valueNumeric: t.valueNumeric,

          valueJson,

          rebuiltAt: new Date(),

        },

      });

      written += 1;

    }

  }



  return { written, skipped };

}



/**

 * Read platform MRR snapshot for a calendar day + currency.

 * Prefers total key; merges valueJson when present.

 * Incomplete valueJson with null/undefined valueNumeric → null (not false zero).

 */

export async function readMrrSnapshot(prisma, { date, currency } = {}) {

  const keys = mrrMetricKeys(currency);

  if (!date || !keys.currency) return null;

  if (!prisma?.analyticsDailySnapshot?.findUnique) return null;



  const snapshotDate = startOfUtcDay(date);

  const row = await prisma.analyticsDailySnapshot.findUnique({

    where: {

      snapshotDate_metricKey_tenantId: {

        snapshotDate,

        metricKey: keys.total,

        tenantId: PLATFORM_SNAPSHOT_TENANT_ID,

      },

    },

  });



  if (!row) return null;



  const vj =

    row.valueJson && typeof row.valueJson === 'object' ? row.valueJson : null;

  const total = moneyOrNull(vj?.total ?? row.valueNumeric);

  // Row exists but no usable total → missing (bridge goes UNAVAILABLE)

  if (total == null) return null;



  return {

    date: dayKeyUtc(snapshotDate),

    snapshotDate,

    currency: keys.currency,

    total,

    core: moneyOrNull(vj?.core) ?? 0,

    mraEis: moneyOrNull(vj?.mraEis) ?? 0,

    // Missing confidence must not default to HIGH (not bridge-ready).
    confidence: vj?.confidence || 'UNKNOWN',

    bySubscription: vj?.bySubscription || null,

    valueJson: vj || {},

    metricKey: keys.total,

  };

}



/**

 * Refresh today's MRR snapshots from a point-in-time summary.

 */

export async function persistPointInTimeMrrSnapshot(prisma, summary, { asOf = new Date() } = {}) {

  if (!summary?.currency) return { written: 0, skipped: 1 };

  const day = {

    date: dayKeyUtc(asOf),

    snapshotDate: startOfUtcDay(asOf),

    currency: summary.currency,

    total: summary.total,

    core: summary.core,

    mraEis: summary.mraEis,

    bySubscription: summary.bySubscription,

    confidence: 'HIGH',

    rowCount: summary.rowCount,

  };

  return persistMrrSnapshots(prisma, { days: [day], currency: summary.currency });

}


