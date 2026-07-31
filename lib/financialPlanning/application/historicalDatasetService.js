import { assessHistoricalDataQuality, buildSeasonalIndices } from '../domain/historicalQuality.js';
import { parseToMinor } from '../domain/money.js';

/**
 * Build a planning historical dataset from canonical reporting / period snapshots.
 * Preference: closed period snapshots → verified reports → provisional GL actuals (labelled).
 * Never uses invoice/expense operational tables as financial actuals.
 */
export async function buildHistoricalDataset(db, context, { lookbackMonths = 24 } = {}) {
  const tenantId = context.businessId;
  const periods = await loadRecentPeriods(db, tenantId, lookbackMonths);
  const points = [];
  let closedPeriodCount = 0;
  let missingMonths = 0;
  let materialExceptions = 0;
  let unbalancedPeriods = 0;
  const revenueSeries = [];

  for (const period of periods) {
    const isClosed = ['CLOSED', 'LOCKED'].includes(String(period.status || '').toUpperCase());
    if (isClosed) closedPeriodCount += 1;

    const snap = await loadPeriodSnapshot(db, tenantId, period);
    if (!snap) {
      missingMonths += 1;
      points.push({
        periodId: period.id,
        periodKey: periodKey(period),
        status: isClosed ? 'CLOSED_MISSING_SNAPSHOT' : 'PROVISIONAL_MISSING',
        provisional: !isClosed,
        amountMinor: null,
        disclosedGap: true,
      });
      continue;
    }

    if (snap.integrityStatus === 'INVALID' || snap.hasExceptions) {
      materialExceptions += 1;
    }
    if (snap.balanced === false) unbalancedPeriods += 1;

    const revenueMinor = snap.revenueMinor ?? 0n;
    revenueSeries.push(Number(revenueMinor) / 100);
    points.push({
      periodId: period.id,
      periodKey: periodKey(period),
      status: isClosed ? 'CLOSED' : 'PROVISIONAL',
      provisional: !isClosed,
      source: snap.source,
      sourceDataVersion: snap.sourceDataVersion,
      snapshotId: snap.snapshotId,
      integrityStatus: snap.integrityStatus || 'UNKNOWN',
      revenueMinor: String(revenueMinor),
      netProfitMinor: String(snap.netProfitMinor ?? 0n),
      cashMinor: snap.cashMinor != null ? String(snap.cashMinor) : null,
      disclosedGap: false,
    });
  }

  const quality = assessHistoricalDataQuality({
    periodCount: periods.length,
    closedPeriodCount,
    missingMonths,
    materialExceptions,
    unbalancedPeriods,
    lookbackMonths,
  });
  const seasonality = buildSeasonalIndices(revenueSeries);

  const latestRevenue =
    [...points].reverse().find((p) => p.revenueMinor != null)?.revenueMinor || '0';

  return {
    tenantId,
    lookbackMonths,
    periods: points,
    quality,
    seasonality,
    suggestedBaseRevenueMinor: latestRevenue,
    authority: {
      preferenceOrder: [
        'APPROVED_CLOSED_PERIOD_SNAPSHOT',
        'VERIFIED_CLOSED_PERIOD_REPORT',
        'CANONICAL_POSTED_GL_ACTUALS',
        'PROVISIONAL_OPEN_PERIOD_ACTUALS_LABELLED',
      ],
      forbidden: [
        'INVOICE_TOTALS_AS_REVENUE',
        'EXPENSE_TABLE_TOTALS',
        'PAYROLL_TABLE_TOTALS',
        'INVENTORY_OPERATIONAL_TOTALS',
      ],
    },
    generatedAt: new Date().toISOString(),
  };
}

function periodKey(period) {
  if (period.code) return period.code;
  if (period.startDate) {
    const d = new Date(period.startDate);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return period.id;
}

async function loadRecentPeriods(db, tenantId, lookbackMonths) {
  if (typeof db.acctV2AccountingPeriod?.findMany === 'function') {
    return db.acctV2AccountingPeriod.findMany({
      where: { tenantId },
      orderBy: { startDate: 'desc' },
      take: lookbackMonths,
    }).then((rows) => rows.reverse());
  }
  return [];
}

async function loadPeriodSnapshot(db, tenantId, period) {
  // Prefer report run / snapshot tables when present
  // Snapshots are linked via report runs (filters may include periodId).
  if (typeof db.acctV2ReportRun?.findFirst === 'function') {
    const run = await db.acctV2ReportRun.findFirst({
      where: {
        tenantId,
        reportType: { in: ['INCOME_STATEMENT', 'PROFIT_AND_LOSS'] },
        OR: [
          { filters: { path: ['periodId'], equals: period.id } },
          { filters: { path: ['accountingPeriodId'], equals: period.id } },
        ],
      },
      orderBy: { generatedAt: 'desc' },
      include: {
        snapshots: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    const snap = run?.snapshots?.[0];
    if (snap?.payload) {
      const revenue = extractLine(snap.payload, ['revenue', 'totalRevenue', 'REVENUE']);
      const net = extractLine(snap.payload, ['netProfit', 'netIncome', 'NET_PROFIT']);
      return {
        source: 'APPROVED_CLOSED_PERIOD_SNAPSHOT',
        sourceDataVersion: snap.checksum || run.accountingDataVersion || snap.id,
        snapshotId: snap.id,
        integrityStatus: run.integrityStatus || snap.integrityStatus || 'UNKNOWN',
        balanced: true,
        hasExceptions: Boolean(run.integrityWarnings),
        revenueMinor: parseToMinor(revenue ?? 0),
        netProfitMinor: parseToMinor(net ?? 0),
        cashMinor: null,
      };
    }
  }

  // Fallback: metadata on period if reports stored totals (never invent)
  if (period.metadata?.planningActuals) {
    const m = period.metadata.planningActuals;
    return {
      source: period.status === 'CLOSED' ? 'VERIFIED_CLOSED_PERIOD_REPORT' : 'PROVISIONAL_OPEN_PERIOD_ACTUALS_LABELLED',
      sourceDataVersion: m.sourceDataVersion || `period:${period.id}`,
      snapshotId: null,
      integrityStatus: m.integrityStatus || 'UNKNOWN',
      balanced: m.balanced !== false,
      hasExceptions: Boolean(m.hasExceptions),
      revenueMinor: parseToMinor(m.revenue ?? 0),
      netProfitMinor: parseToMinor(m.netProfit ?? 0),
      cashMinor: m.cash != null ? parseToMinor(m.cash) : null,
    };
  }

  return null;
}

function extractLine(payload, keys) {
  if (!payload || typeof payload !== 'object') return null;
  for (const k of keys) {
    if (payload[k] != null) return payload[k]?.decimal ?? payload[k]?.amount ?? payload[k];
    if (payload.totals?.[k] != null) {
      return payload.totals[k]?.decimal ?? payload.totals[k]?.amount ?? payload.totals[k];
    }
  }
  if (Array.isArray(payload.lines)) {
    for (const line of payload.lines) {
      const code = String(line.code || line.key || line.name || '').toUpperCase();
      if (keys.some((k) => code.includes(String(k).toUpperCase()))) {
        return line.amount ?? line.value ?? line.total;
      }
    }
  }
  return null;
}

/**
 * Opening BS for projection — from latest balance sheet snapshot when available.
 */
export async function loadOpeningBalancesForPlanning(db, context) {
  const tenantId = context.businessId;
  if (typeof db.acctV2ReportRun?.findFirst === 'function') {
    const run = await db.acctV2ReportRun.findFirst({
      where: {
        tenantId,
        reportType: { in: ['BALANCE_SHEET', 'STATEMENT_OF_FINANCIAL_POSITION'] },
        status: { in: ['APPROVED', 'GENERATED', 'REVIEWED'] },
      },
      orderBy: { generatedAt: 'desc' },
      include: {
        snapshots: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    const snap = run?.snapshots?.[0];
    const opening = snap?.payload?.planningOpening || snap?.payload?.openingBalances;
    if (opening) {
      return {
        opening,
        sourceDataVersion: snap.checksum || run.accountingDataVersion || snap.id,
        source: 'APPROVED_CLOSED_PERIOD_SNAPSHOT',
        provisional: run.status !== 'APPROVED',
      };
    }
  }

  // Explicit empty — callers must supply opening or use pilot defaults in UI only for demos
  return {
    opening: null,
    sourceDataVersion: null,
    source: 'NONE',
    provisional: true,
    note: 'No approved Balance Sheet snapshot available for planning opening balances.',
  };
}
