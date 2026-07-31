/**
 * MRR bridge / waterfall envelopes from adjacent daily snapshots.
 * Missing open/close snapshots → entire bridge UNAVAILABLE (no invented components).
 */

import {
  METRIC_STATUS,
  metricEnvelope,
  unavailableMetric,
} from '@/lib/admin/intelligence/metricStates.js';
import { REVENUE_KPI_CODES, getRevenueDefinition } from './metricCatalogue.js';
import { readMrrSnapshot } from './mrrSnapshots.js';
import { startOfUtcDay } from './reconstructMrr.js';

function def(code) {
  return getRevenueDefinition(code);
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function moneyEnvelope(code, value, extras = {}) {
  const d = def(code);
  return metricEnvelope({
    code,
    status: extras.status || METRIC_STATUS.READY_WITH_LIMITATIONS,
    value: roundMoney(value),
    unit: 'money',
    currency: extras.currency,
    label: d.label,
    definition: d.definition,
    source: d.source,
    period: extras.period,
    freshness: extras.freshness,
    limitations:
      extras.limitations ||
      'Estimated contracted MRR bridge from reconstruct-then-snapshot; not GAAP.',
    reasonCode: extras.reasonCode || null,
    reasonMessage: extras.reasonMessage || null,
    masked: Boolean(extras.masked),
  });
}

function unavailableBridge(code, reasonMessage, extras = {}) {
  const d = def(code);
  return unavailableMetric(code, reasonMessage, {
    status: METRIC_STATUS.UNAVAILABLE,
    reasonCode: extras.reasonCode || 'bridge_unavailable',
    label: d.label,
    definition: d.definition,
    source: d.source,
    currency: extras.currency || null,
    period: extras.period,
    ...extras,
  });
}

/** HIGH / MIXED / OK only — UNKNOWN/null/LOW_CONFIDENCE are not bridge-ready. */
export function isBridgeReadyConfidence(confidence) {
  return confidence === 'HIGH' || confidence === 'MIXED' || confidence === 'OK';
}

/**
 * Classify movements when both snapshots carry bySubscription maps.
 */
export function classifyMrrMovements(openBySub, closeBySub) {
  const open = openBySub || {};
  const close = closeBySub || {};
  let neu = 0;
  let expansion = 0;
  let contraction = 0;
  let churned = 0;
  const openIds = new Set(Object.keys(open));
  const closeIds = new Set(Object.keys(close));

  for (const id of closeIds) {
    const closeMrr = Number(close[id]?.mrr) || 0;
    if (!openIds.has(id)) {
      neu += closeMrr;
      continue;
    }
    const openMrr = Number(open[id]?.mrr) || 0;
    const delta = closeMrr - openMrr;
    if (delta > 0) expansion += delta;
    else if (delta < 0) contraction += Math.abs(delta);
  }

  for (const id of openIds) {
    if (!closeIds.has(id)) {
      churned += Number(open[id]?.mrr) || 0;
    }
  }

  return {
    new: roundMoney(neu),
    expansion: roundMoney(expansion),
    contraction: roundMoney(contraction),
    churned: roundMoney(churned),
    // Prior churn evidence not tracked in Wave 1 snapshots
    reactivation: null,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ periodStart: Date|string, periodEnd: Date|string, currency: string, masked?: boolean }} opts
 */
export async function buildMrrBridge(prisma, opts = {}) {
  const currency = opts.currency ? String(opts.currency).toUpperCase() : null;
  const periodStart = opts.periodStart ? startOfUtcDay(opts.periodStart) : null;
  const periodEnd = opts.periodEnd ? startOfUtcDay(opts.periodEnd) : null;
  const period =
    periodStart && periodEnd
      ? { start: periodStart.toISOString(), end: periodEnd.toISOString() }
      : null;
  const masked = Boolean(opts.masked);

  const bridgeCodes = [
    REVENUE_KPI_CODES.BRIDGE_OPENING,
    REVENUE_KPI_CODES.BRIDGE_CLOSING,
    REVENUE_KPI_CODES.BRIDGE_NEW,
    REVENUE_KPI_CODES.BRIDGE_EXPANSION,
    REVENUE_KPI_CODES.BRIDGE_CONTRACTION,
    REVENUE_KPI_CODES.BRIDGE_CHURNED,
    REVENUE_KPI_CODES.BRIDGE_REACTIVATION,
    REVENUE_KPI_CODES.BRIDGE_NET_NEW,
  ];

  const allUnavailable = (reasonMessage, reasonCode = 'bridge_unavailable') => {
    const metrics = {};
    for (const code of bridgeCodes) {
      metrics[code] = unavailableBridge(code, reasonMessage, {
        reasonCode,
        currency,
        period,
        masked,
      });
    }
    return { ok: true, available: false, metrics, reason: reasonMessage };
  };

  if (!currency || currency === 'ALL' || currency === '*') {
    return allUnavailable(
      'Cross-currency MRR bridge is UNAVAILABLE without a certified FX rate source.',
      'fx_unavailable'
    );
  }
  if (!periodStart || !periodEnd) {
    return allUnavailable('periodStart and periodEnd are required for MRR bridge.');
  }

  const [opening, closing] = await Promise.all([
    readMrrSnapshot(prisma, { date: periodStart, currency }),
    readMrrSnapshot(prisma, { date: periodEnd, currency }),
  ]);

  if (!opening || !closing) {
    return allUnavailable(
      'Opening or closing MRR snapshot missing for the period; reconstruct-then-snapshot required before bridge components are available.',
      'snapshots_missing'
    );
  }

  if (!isBridgeReadyConfidence(opening.confidence) || !isBridgeReadyConfidence(closing.confidence)) {
    const reasonCode =
      opening.confidence === 'LOW_CONFIDENCE' || closing.confidence === 'LOW_CONFIDENCE'
        ? 'low_confidence'
        : 'confidence_unknown';
    return allUnavailable(
      'Opening/closing snapshot confidence is too low or unknown for bridge classification.',
      reasonCode
    );
  }

  const freshness = {
    asOf: new Date().toISOString(),
    status: 'SNAPSHOT',
    openingDate: opening.date,
    closingDate: closing.date,
  };

  const metrics = {};
  metrics[REVENUE_KPI_CODES.BRIDGE_OPENING] = moneyEnvelope(
    REVENUE_KPI_CODES.BRIDGE_OPENING,
    opening.total,
    { currency, period, freshness, masked }
  );
  metrics[REVENUE_KPI_CODES.BRIDGE_CLOSING] = moneyEnvelope(
    REVENUE_KPI_CODES.BRIDGE_CLOSING,
    closing.total,
    { currency, period, freshness, masked }
  );
  metrics[REVENUE_KPI_CODES.BRIDGE_NET_NEW] = moneyEnvelope(
    REVENUE_KPI_CODES.BRIDGE_NET_NEW,
    closing.total - opening.total,
    {
      currency,
      period,
      freshness,
      masked,
      limitations: 'Net new = closing − opening estimated MRR from daily snapshots.',
    }
  );

  const openMap = opening.bySubscription;
  const closeMap = closing.bySubscription;
  if (!openMap || !closeMap || typeof openMap !== 'object' || typeof closeMap !== 'object') {
    const reason =
      'Subscription-level snapshot detail missing; movement components UNAVAILABLE (opening/closing still available).';
    for (const code of [
      REVENUE_KPI_CODES.BRIDGE_NEW,
      REVENUE_KPI_CODES.BRIDGE_EXPANSION,
      REVENUE_KPI_CODES.BRIDGE_CONTRACTION,
      REVENUE_KPI_CODES.BRIDGE_CHURNED,
      REVENUE_KPI_CODES.BRIDGE_REACTIVATION,
    ]) {
      metrics[code] = unavailableBridge(code, reason, {
        reasonCode: 'movement_detail_missing',
        currency,
        period,
        masked,
      });
    }
    return { ok: true, available: true, metrics, opening, closing, movements: null };
  }

  const movements = classifyMrrMovements(openMap, closeMap);
  metrics[REVENUE_KPI_CODES.BRIDGE_NEW] = moneyEnvelope(
    REVENUE_KPI_CODES.BRIDGE_NEW,
    movements.new,
    {
      currency,
      period,
      freshness,
      masked,
      // Wave 1: open→close joins without prior churn evidence cannot separate reactivations
      limitations:
        'Includes possible reactivations; reactivation not separately evidenced.',
    }
  );
  metrics[REVENUE_KPI_CODES.BRIDGE_EXPANSION] = moneyEnvelope(
    REVENUE_KPI_CODES.BRIDGE_EXPANSION,
    movements.expansion,
    { currency, period, freshness, masked }
  );
  metrics[REVENUE_KPI_CODES.BRIDGE_CONTRACTION] = moneyEnvelope(
    REVENUE_KPI_CODES.BRIDGE_CONTRACTION,
    movements.contraction,
    { currency, period, freshness, masked }
  );
  metrics[REVENUE_KPI_CODES.BRIDGE_CHURNED] = moneyEnvelope(
    REVENUE_KPI_CODES.BRIDGE_CHURNED,
    movements.churned,
    { currency, period, freshness, masked }
  );
  metrics[REVENUE_KPI_CODES.BRIDGE_REACTIVATION] = unavailableBridge(
    REVENUE_KPI_CODES.BRIDGE_REACTIVATION,
    'Prior churn evidence is not available in Wave 1 snapshots; reactivation not classified separately from new MRR.',
    { reasonCode: 'reactivation_untracked', currency, period, masked }
  );

  return { ok: true, available: true, metrics, opening, closing, movements };
}
