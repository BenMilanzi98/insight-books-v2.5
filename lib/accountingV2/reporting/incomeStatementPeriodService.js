/**
 * Periodized Income Statement (month/quarter columns) with accrual or cash basis.
 */
import { getReportDefinition } from './reportDefinitions.js';
import {
  buildReportEnvelope,
  buildReportLine,
  amount,
} from './reportContracts.js';
import { loadOpenAccountingExceptions } from './trialBalanceService.js';
import { buildPeriodBuckets, alignPeriodAmounts } from './periodBuckets.js';
import { buildCashBasisAccountMovements } from './incomeStatementCashBasis.js';
import {
  buildIncomeStatementBodyFromAccounts,
  slimIncomeStatementEnvelope,
  finalizeEnvelope,
} from './financialStatementService.js';

const movementSigned = (r) => r.periodDebitMinor - r.periodCreditMinor;

function methodLabel(reportBasis, currency) {
  const cur = currency || 'MWK';
  return reportBasis === 'CASH' ? `Income Collected (${cur})` : `Income Billed (${cur})`;
}

async function bodyForScope(db, context, scope, definition, includeZero, reportBasis) {
  if (reportBasis === 'CASH') {
    const cash = await buildCashBasisAccountMovements(db, context, scope);
    return buildIncomeStatementBodyFromAccounts(definition, cash.accounts, includeZero, {
      sourceTypeByAccount: cash.sourceTypeByAccount,
    });
  }
  const { buildIncomeStatementBody } = await import('./financialStatementService.js');
  return buildIncomeStatementBody(db, context, scope, definition, includeZero);
}

/**
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context
 * @param {object} request normalized report request
 */
export async function generatePeriodizedIncomeStatement(db, context, request) {
  const definition = getReportDefinition('INCOME_STATEMENT', request.reportDefinitionVersion);
  const groupBy = request.groupBy === 'QUARTER' ? 'QUARTER' : 'MONTH';
  const reportBasis = request.reportBasis === 'CASH' ? 'CASH' : 'ACCRUAL';
  const breakdown = request.breakdown === 'SOURCE_TYPE' ? 'SOURCE_TYPE' : 'ACCOUNT';
  const includeZero = Boolean(request.includeZeroBalances);

  const fromDate = request.fromDate;
  const toDate = request.toDate;

  let citMeta = null;
  try {
    const {
      ensureCitProvisionForPeriod,
      applyCitDisplayToBody,
      shouldShowCalculatedCit,
    } = await import('./citProvisionService.js');
    const seedBody = await bodyForScope(db, context, request, definition, includeZero, reportBasis);
    const npbtMinor = seedBody.lineMinors.get('profit-before-tax') ?? 0;
    citMeta = await ensureCitProvisionForPeriod({
      db,
      tenantId: context.businessId,
      userId: context.userId,
      fromDate,
      toDate,
      npbtMinor,
      reportBasis,
      branchId: request.branchId ?? null,
      currency: request.currency || context.baseCurrency || 'MWK',
      apply: Boolean(request.applyCitProvision) && reportBasis === 'ACCRUAL',
      hasPermission: () => true,
    });
    if (shouldShowCalculatedCit(citMeta)) {
      applyCitDisplayToBody(seedBody, citMeta.citMinor);
      request = { ...request, __citDisplayBody: seedBody, __citMeta: citMeta };
    }
  } catch (err) {
    citMeta = {
      posted: false,
      reason: 'CIT_ERROR',
      warning: err?.message || 'CIT provision failed',
    };
  }

  const buckets = buildPeriodBuckets(fromDate, toDate, groupBy);
  if (!buckets.length) {
    const body =
      request.__citDisplayBody ||
      (await bodyForScope(db, context, request, definition, includeZero, reportBasis));
    const envelope = await assembleEnvelope(
      db,
      context,
      request,
      definition,
      body,
      [],
      reportBasis,
      breakdown,
      groupBy
    );
    if (citMeta) {
      envelope.meta = { ...(envelope.meta || {}), cit: citMeta };
      if (citMeta.warning) {
        envelope.warnings = [...(envelope.warnings || []), citMeta.warning];
      }
    }
    return envelope;
  }

  const periodBodies = [];
  for (const b of buckets) {
    const body = await bodyForScope(
      db,
      context,
      { ...request, fromDate: b.fromDate, toDate: b.toDate },
      definition,
      includeZero,
      reportBasis
    );
    periodBodies.push({ key: b.key, body });
  }

  // Put period CIT on the last bucket so month/quarter columns reflect provision.
  if (citMeta && Number(citMeta.citMinor) > 0 && periodBodies.length) {
    const { applyCitDisplayToBody } = await import('./citProvisionService.js');
    const last = periodBodies[periodBodies.length - 1];
    applyCitDisplayToBody(last.body, citMeta.citMinor);
  }

  const fullBody =
    request.__citDisplayBody ||
    (await bodyForScope(db, context, request, definition, includeZero, reportBasis));
  if (citMeta && Number(citMeta.citMinor) >= 0 && !request.__citDisplayBody) {
    const { applyCitDisplayToBody, shouldShowCalculatedCit } = await import(
      './citProvisionService.js'
    );
    if (shouldShowCalculatedCit(citMeta)) applyCitDisplayToBody(fullBody, citMeta.citMinor);
  }
  const envelope = await assembleEnvelope(
    db,
    context,
    request,
    definition,
    fullBody,
    buckets.map((b, i) => ({ ...b, body: periodBodies[i].body })),
    reportBasis,
    breakdown,
    groupBy
  );
  if (citMeta) {
    envelope.meta = { ...(envelope.meta || {}), cit: citMeta };
    if (citMeta.warning) {
      envelope.warnings = [...(envelope.warnings || []), citMeta.warning];
    }
  }
  return envelope;
}

async function assembleEnvelope(
  db,
  context,
  request,
  definition,
  fullBody,
  periodBucketsWithBodies,
  reportBasis,
  breakdown,
  groupBy
) {
  const exceptions = await loadOpenAccountingExceptions(db, context);
  const periodKeys = periodBucketsWithBodies.map((b) => b.key);

  const lines = definition.lines.map((defLine, i) => {
    const minorsByPeriod = new Map();
    for (const pb of periodBucketsWithBodies) {
      minorsByPeriod.set(pb.key, pb.body.lineMinors.get(defLine.lineId) ?? 0);
    }
    const periodAmounts = alignPeriodAmounts(periodKeys, minorsByPeriod);
    const currentMinor = fullBody.lineMinors.get(defLine.lineId) ?? 0;

    const base = buildReportLine({
      lineId: defLine.lineId,
      label: defLine.label,
      lineType: defLine.lineType,
      parentLineId: defLine.parentLineId ?? null,
      displayOrder: defLine.displayOrder ?? i,
      currentMinor,
      comparativeMinor: null,
      accounts: fullBody.accountsByLine.get(defLine.lineId) ?? [],
      mappingRule: defLine.match ?? defLine.formula ?? null,
      displaySign: defLine.displaySign ?? 1,
    });

    let children = [];
    if (defLine.lineType === 'ACCOUNT_GROUP') {
      if (breakdown === 'SOURCE_TYPE' && fullBody.sourceTypeTotals) {
        const bySrc = fullBody.sourceTypeTotals.get(defLine.lineId) || new Map();
        children = [...bySrc.entries()].map(([src, minor]) => ({
          lineId: `${defLine.lineId}::src::${src}`,
          label: src,
          lineType: 'ACCOUNT',
          currentAmount: amount(minor),
          periodAmounts: alignPeriodAmounts(
            periodKeys,
            Object.fromEntries(
              periodBucketsWithBodies.map((pb) => {
                const m = pb.body.sourceTypeTotals?.get(defLine.lineId)?.get(src) ?? 0;
                return [pb.key, m];
              })
            )
          ),
        }));
      } else {
        const accounts = fullBody.accountsByLine.get(defLine.lineId) ?? [];
        children = accounts.map((acc) => {
          const periodMap = {};
          for (const pb of periodBucketsWithBodies) {
            const refs = pb.body.accountsByLine.get(defLine.lineId) ?? [];
            const hit = refs.find((r) => r.accountId === acc.accountId);
            periodMap[pb.key] = hit?.amount?.minor ?? 0;
          }
          return {
            lineId: `${defLine.lineId}::acct::${acc.accountId}`,
            label: `${acc.accountCode || ''} ${acc.accountName || ''}`.trim(),
            lineType: 'ACCOUNT',
            accountId: acc.accountId,
            currentAmount: acc.amount,
            periodAmounts: alignPeriodAmounts(periodKeys, periodMap),
          };
        });
      }
    }

    return {
      ...base,
      periodAmounts,
      children,
    };
  });

  const revenueMinor = fullBody.lineMinors.get('revenue') ?? 0;
  const netProfitMinor = fullBody.lineMinors.get('net-profit') ?? 0;
  const grossProfitMinor = fullBody.lineMinors.get('gross-profit') ?? 0;

  const envelope = buildReportEnvelope(context, request, definition, {
    drillDownBasis: 'PERIOD',
    lines,
    totals: {
      revenue: amount(revenueMinor),
      grossProfit: amount(grossProfitMinor),
      ebitda: amount(fullBody.lineMinors.get('ebitda') ?? 0),
      operatingProfit: amount(fullBody.lineMinors.get('operating-profit') ?? 0),
      profitBeforeTax: amount(fullBody.lineMinors.get('profit-before-tax') ?? 0),
      netProfit: amount(netProfitMinor),
      grossMarginPercent:
        revenueMinor !== 0 ? Number(((grossProfitMinor / revenueMinor) * 100).toFixed(2)) : null,
      netMarginPercent:
        revenueMinor !== 0 ? Number(((netProfitMinor / revenueMinor) * 100).toFixed(2)) : null,
    },
    unresolvedExceptions: exceptions,
  });

  envelope.periods = periodBucketsWithBodies.map((b) => ({
    key: b.key,
    label: b.label,
    from: b.fromDate?.toISOString?.() ?? null,
    to: b.toDate?.toISOString?.() ?? null,
  }));
  envelope.meta = {
    accountingMethod: reportBasis,
    groupBy,
    breakdown,
    methodLabel: methodLabel(reportBasis, request.currency || context.baseCurrency),
  };

  const equationFailures = [];
  const expectedNetProfit = fullBody.directNetProfit + fullBody.pnlUnmappedSigned;
  if (netProfitMinor !== expectedNetProfit && reportBasis === 'ACCRUAL') {
    equationFailures.push({
      code: 'REP-002',
      message: `Statement net profit ${netProfitMinor} differs from direct P&L computation ${expectedNetProfit} (minor units).`,
      differenceMinor: netProfitMinor - expectedNetProfit,
    });
  }

  const finalized = finalizeEnvelope(envelope, {
    unmapped: fullBody.unmapped,
    assisted: fullBody.assisted,
    exceptionalHeaders: fullBody.exceptionalHeaders,
    ledgerAnomalies: fullBody.summary?.anomalies ?? [],
    equationFailures,
  });

  return slimIncomeStatementEnvelope(finalized);
}
