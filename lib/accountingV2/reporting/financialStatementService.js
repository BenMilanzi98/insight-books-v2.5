/**
 * Phase 7 — Financial Statement services.
 *
 * Income Statement (period activity), Statement of Financial Position
 * (cumulative as-of), Cash Flow Statement (indirect method — the default
 * approved method) and Statement of Changes in Equity. All amounts derive from
 * the Phase 5 General Ledger Query Service over canonical posted journal
 * lines; operational tables and stored balances are never read.
 *
 * Sign conventions: ledger balances are signed debit-positive (minor units).
 * Statement lines are presented "natural-positive": revenue / liability /
 * equity lines multiply by −1 so credit-normal balances display positive.
 * Current Year Earnings and Retained Earnings are CALCULATED from P&L account
 * activity (method A, §27) — never typed, never read from a stored balance,
 * and never counted twice (P&L accounts are excluded from Balance Sheet
 * account lines by scope).
 */

import { getBusinessLedgerSummary } from '../ledger/ledgerQueryService.js';
import {
  getReportDefinition,
  assignAccountsToLines,
  evaluateFormula,
  resolveAccountProfile,
  isAmountBearingAccount,
} from './reportDefinitions.js';
import {
  buildReportEnvelope,
  buildReportLine,
  amount,
  REPORT_INTEGRITY_STATUS,
} from './reportContracts.js';
import { loadOpenAccountingExceptions } from './trialBalanceService.js';

const movementSigned = (r) => r.periodDebitMinor - r.periodCreditMinor;
const openingSigned = (r) => r.opening.signedMinor;
const closingSigned = (r) => r.closing.signedMinor;

function displayAccountName(r) {
  const code = String(r.accountCode ?? r.code ?? '').trim();
  const name = String(r.accountName ?? r.name ?? '');
  if (code === '5110' && /purchase/i.test(name)) return 'Cost of Goods Sold';
  return name || r.accountName;
}

const accountRef = (r, minor) => ({
  accountId: r.accountId,
  accountCode: r.accountCode,
  accountName: displayAccountName(r),
  amount: amount(minor),
  lineCount: r.lineCount,
});

const SLIM_PL_KEEP = new Set(['revenue', 'cost-of-sales', 'gross-profit', 'operating-expenses', 'tax-expense', 'net-profit']);
const SLIM_PL_FOLD_INTO_OPEX = new Set([
  'depreciation-amortization',
  'other-expenses',
  'finance-costs',
]);

function slimIncomeStatementEnvelope(envelope) {
  const byId = new Map((envelope.lines || []).map((l) => [l.lineId, l]));
  const opex = byId.get('operating-expenses');
  if (opex) {
    let extra = 0;
    const extraAccounts = [...(opex.accounts || [])];
    for (const id of SLIM_PL_FOLD_INTO_OPEX) {
      const line = byId.get(id);
      extra += line?.currentAmount?.minor ?? 0;
      extraAccounts.push(...(line?.accounts || []));
    }
    const otherIncome = byId.get('other-income');
    const otherIncomeMinor = otherIncome?.currentAmount?.minor ?? 0;
    opex.currentAmount = amount((opex.currentAmount?.minor ?? 0) + extra);
    opex.accounts = extraAccounts;
    opex.accountIds = extraAccounts.map((a) => a.accountId);
    if (otherIncomeMinor !== 0) {
      opex.currentAmount = amount((opex.currentAmount?.minor ?? 0) - otherIncomeMinor);
    }
  }
  const tax = byId.get('tax-expense');
  envelope.lines = (envelope.lines || []).filter((l) => {
    if (!SLIM_PL_KEEP.has(l.lineId)) return false;
    if (l.lineId === 'tax-expense' && !(tax?.currentAmount?.minor)) return false;
    return true;
  });
  envelope.presentation = 'slim';
  return envelope;
}

function finalizeEnvelope(
  envelope,
  { unmapped = [], assisted = [], equationFailures = [], exceptionalHeaders = [], ledgerAnomalies = [] } = {}
) {
  const materialUnmapped = unmapped.filter(
    (u) => movementSigned(u) !== 0 || closingSigned(u) !== 0
  );
  for (const u of materialUnmapped) {
    envelope.integrityWarnings.push({
      code: 'REP-036',
      message: `Account ${u.accountCode ?? u.accountId} has activity but no report mapping; amount disclosed, not silently excluded.`,
      accountId: u.accountId,
      amount: amount(closingSigned(u) || movementSigned(u)),
      origin: 'CURRENT_SYSTEM',
    });
  }
  for (const a of assisted) {
    envelope.integrityWarnings.push({
      code: 'MAPPING_ASSISTED',
      message: `Account ${a.accountCode ?? a.accountId} mapped by legacy-type/name assist (line ${a.lineId}); confirm Phase 3 classification.`,
      accountId: a.accountId,
      origin: 'CURRENT_SYSTEM',
    });
  }
  for (const h of exceptionalHeaders) {
    envelope.integrityWarnings.push({
      code: 'REP-041',
      message: `Header account ${h.accountCode ?? h.accountId} has direct posted activity; included once on line ${h.lineId} (R4-A exceptional posting).`,
      accountId: h.accountId,
      lineId: h.lineId,
      origin: 'CURRENT_SYSTEM',
    });
  }
  for (const a of ledgerAnomalies) {
    if (a.rule === 'GL-110' && exceptionalHeaders.some((h) => h.accountId === a.accountId)) continue;
    envelope.integrityWarnings.push({
      code: a.rule,
      message: a.message,
      accountId: a.accountId ?? null,
      origin: 'CURRENT_SYSTEM',
    });
  }
  for (const f of equationFailures) {
    envelope.integrityWarnings.push({ ...f, origin: 'CURRENT_SYSTEM' });
  }
  const blocking =
    equationFailures.length > 0 || materialUnmapped.length > 0;
  envelope.integrityStatus = blocking
    ? REPORT_INTEGRITY_STATUS.UNVERIFIED
    : envelope.integrityWarnings.length > 0 || envelope.unresolvedExceptions.length > 0
      ? REPORT_INTEGRITY_STATUS.VERIFIED_WITH_WARNINGS
      : REPORT_INTEGRITY_STATUS.VERIFIED;
  return envelope;
}

/* ── Income Statement ─────────────────────────────────────────────────────── */

async function buildIncomeStatementBody(db, context, scope, definition, includeZero) {
  const summary = await getBusinessLedgerSummary(db, context, {
    startDate: scope.fromDate ?? undefined,
    endDate: scope.toDate ?? undefined,
    branchId: scope.branchId ?? null,
    includeZeroActivity: includeZero,
  });
  const { assignments, unmapped, assisted, exceptionalHeaders } = assignAccountsToLines(
    definition,
    summary.accounts,
    (profile) => profile.isPnl
  );
  const lineMinors = new Map();
  const accountsByLine = new Map();
  for (const defLine of definition.lines) {
    if (defLine.lineType === 'ACCOUNT_GROUP') {
      const rows = assignments.get(defLine.lineId) ?? [];
      const sign = defLine.displaySign === -1 ? -1 : 1;
      let total = 0;
      const refs = [];
      for (const r of rows) {
        const minor = sign * movementSigned(r);
        total += minor;
        if (minor !== 0 || includeZero) refs.push(accountRef(r, minor));
      }
      lineMinors.set(defLine.lineId, total);
      accountsByLine.set(defLine.lineId, refs);
    }
  }
  for (const defLine of definition.lines) {
    if (defLine.formula) {
      lineMinors.set(defLine.lineId, evaluateFormula(defLine.formula, lineMinors));
    }
  }
  // Net profit must equal the direct P&L computation (REP-002 by construction).
  const pnlUnmappedSigned = unmapped
    .filter((u) => u.profile.isPnl)
    .reduce((s, u) => s + movementSigned(u), 0);
  const directNetProfit = -(
    summary.accounts
      .filter((r) => isAmountBearingAccount(r) && resolveAccountProfile(r).isPnl)
      .reduce((s, r) => s + movementSigned(r), 0)
  );
  return {
    summary,
    lineMinors,
    accountsByLine,
    unmapped,
    assisted,
    exceptionalHeaders,
    directNetProfit,
    pnlUnmappedSigned,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context @param {object} request normalized
 */
export async function generateIncomeStatement(db, context, request) {
  const definition = getReportDefinition('INCOME_STATEMENT', request.reportDefinitionVersion);
  const current = await buildIncomeStatementBody(db, context, request, definition, request.includeZeroBalances);
  const comparative = request.comparison
    ? await buildIncomeStatementBody(db, context, request.comparison, definition, false)
    : null;
  const exceptions = await loadOpenAccountingExceptions(db, context);

  const lines = definition.lines.map((defLine, i) =>
    buildReportLine({
      lineId: defLine.lineId,
      label: defLine.label,
      lineType: defLine.lineType,
      parentLineId: defLine.parentLineId ?? null,
      displayOrder: defLine.displayOrder ?? i,
      currentMinor: current.lineMinors.get(defLine.lineId) ?? 0,
      comparativeMinor: comparative ? comparative.lineMinors.get(defLine.lineId) ?? 0 : null,
      accounts: current.accountsByLine.get(defLine.lineId) ?? [],
      mappingRule: defLine.match ?? defLine.formula ?? null,
      displaySign: defLine.displaySign ?? 1,
    })
  );

  const netProfitMinor = current.lineMinors.get('net-profit') ?? 0;
  const revenueMinor = current.lineMinors.get('revenue') ?? 0;
  const equationFailures = [];
  // REP-002: statement net profit must equal the direct P&L computation over
  // the accounts the statement mapped. Unmapped P&L activity is excluded from
  // this equation but separately disclosed (REP-036) and blocks VERIFIED.
  const expectedNetProfit = current.directNetProfit + current.pnlUnmappedSigned;
  if (netProfitMinor !== expectedNetProfit) {
    equationFailures.push({
      code: 'REP-002',
      message: `Statement net profit ${netProfitMinor} differs from direct P&L computation ${expectedNetProfit} (minor units).`,
      differenceMinor: netProfitMinor - expectedNetProfit,
    });
  }

  const envelope = buildReportEnvelope(context, request, definition, {
    drillDownBasis: 'PERIOD',
    lines,
    totals: {
      revenue: amount(revenueMinor),
      grossProfit: amount(current.lineMinors.get('gross-profit') ?? 0),
      ebitda: amount(current.lineMinors.get('ebitda') ?? 0),
      operatingProfit: amount(current.lineMinors.get('operating-profit') ?? 0),
      profitBeforeTax: amount(current.lineMinors.get('profit-before-tax') ?? 0),
      netProfit: amount(netProfitMinor),
      grossMarginPercent:
        revenueMinor !== 0
          ? Number((((current.lineMinors.get('gross-profit') ?? 0) / revenueMinor) * 100).toFixed(2))
          : null,
      netMarginPercent:
        revenueMinor !== 0 ? Number(((netProfitMinor / revenueMinor) * 100).toFixed(2)) : null,
    },
    unresolvedExceptions: exceptions,
  });
  const finalized = finalizeEnvelope(envelope, {
    unmapped: current.unmapped,
    assisted: current.assisted,
    exceptionalHeaders: current.exceptionalHeaders,
    ledgerAnomalies: current.summary.anomalies ?? [],
    equationFailures,
  });
  if (request?.keepFullStatement) return finalized;
  return slimIncomeStatementEnvelope(finalized);
}

/* ── Statement of Financial Position ─────────────────────────────────────── */

async function buildBalanceSheetBody(db, context, asOfDate, fyStartDate, branchId, definition, includeZero) {
  const [cumulative, fyWindow] = await Promise.all([
    getBusinessLedgerSummary(db, context, {
      endDate: asOfDate ?? undefined,
      branchId: branchId ?? null,
      includeZeroActivity: includeZero,
    }),
    getBusinessLedgerSummary(db, context, {
      startDate: fyStartDate ?? undefined,
      endDate: asOfDate ?? undefined,
      branchId: branchId ?? null,
      includeZeroActivity: false,
    }),
  ]);

  const { assignments, unmapped, assisted, exceptionalHeaders } = assignAccountsToLines(
    definition,
    cumulative.accounts,
    (profile) => !profile.isPnl && profile.category != null
  );

  const lineMinors = new Map();
  const accountsByLine = new Map();
  const rePolicyWarnings = [];
  for (const defLine of definition.lines) {
    if (defLine.lineType !== 'ACCOUNT_GROUP') continue;
    const rows = assignments.get(defLine.lineId) ?? [];
    const sign = defLine.displaySign === -1 ? -1 : 1;
    let total = 0;
    const refs = [];
    for (const r of rows) {
      const minor = sign * closingSigned(r);
      total += minor;
      if (minor !== 0 || includeZero) refs.push(accountRef(r, minor));
    }
    lineMinors.set(defLine.lineId, total);
    accountsByLine.set(defLine.lineId, refs);
  }

  // Current Year Earnings and prior-year Retained Earnings — calculated from
  // P&L accounts (never stored, never duplicated). Exceptional P&L headers count once.
  const isPnlRow = (r) => isAmountBearingAccount(r) && resolveAccountProfile(r).isPnl;
  const allTimePnlSigned = cumulative.accounts.filter(isPnlRow).reduce((s, r) => s + closingSigned(r), 0);
  const fyPnlSigned = fyWindow.accounts.filter(isPnlRow).reduce((s, r) => s + movementSigned(r), 0);
  const currentYearEarningsMinor = -fyPnlSigned + 0; // + 0 normalizes -0
  const retainedEarningsMinor = -(allTimePnlSigned - fyPnlSigned) + 0;
  lineMinors.set('current-year-earnings', currentYearEarningsMinor);
  lineMinors.set('retained-earnings-calculated', retainedEarningsMinor);

  // R4-A / Method A: RE appears once. If both posted RE and calculated prior-year
  // P&L RE are non-zero, calculated wins and posted is zeroed for the equity total.
  const postedRE = lineMinors.get('retained-earnings-posted') ?? 0;
  if (postedRE !== 0 && retainedEarningsMinor !== 0) {
    lineMinors.set('retained-earnings-posted', 0);
    rePolicyWarnings.push({
      code: 'REP-016',
      message:
        'Posted Retained Earnings and calculated prior-year earnings were both non-zero; Method A uses calculated RE once and excludes posted RE from totals.',
      differenceMinor: postedRE,
    });
  }

  for (const defLine of definition.lines) {
    if (defLine.formula) lineMinors.set(defLine.lineId, evaluateFormula(defLine.formula, lineMinors));
  }

  // Unclassified accounts (no category at all) — disclosed, not silently dropped.
  const unclassified = cumulative.accounts.filter(
    (r) => isAmountBearingAccount(r) && resolveAccountProfile(r).category == null && closingSigned(r) !== 0
  );
  return {
    cumulative,
    lineMinors,
    accountsByLine,
    unmapped: [...unmapped, ...unclassified.map((r) => ({ ...r, profile: resolveAccountProfile(r) }))],
    assisted,
    exceptionalHeaders,
    rePolicyWarnings,
    currentYearEarningsMinor,
    retainedEarningsMinor,
  };
}

export async function generateBalanceSheet(db, context, request) {
  const definition = getReportDefinition('BALANCE_SHEET', request.reportDefinitionVersion);
  const asOf = request.asOfDate ?? request.toDate ?? new Date();
  const current = await buildBalanceSheetBody(
    db, context, asOf, request.financialYearStartDate, request.branchId, definition, request.includeZeroBalances
  );
  const comparative = request.comparison?.asOfDate
    ? await buildBalanceSheetBody(
        db, context, request.comparison.asOfDate,
        new Date(Date.UTC(request.comparison.asOfDate.getUTCFullYear(), 0, 1)),
        request.branchId, definition, false
      )
    : null;
  const exceptions = await loadOpenAccountingExceptions(db, context);

  const lines = definition.lines.map((defLine, i) =>
    buildReportLine({
      lineId: defLine.lineId,
      label: defLine.label,
      lineType: defLine.lineType,
      parentLineId: defLine.parentLineId ?? null,
      displayOrder: defLine.displayOrder ?? i,
      currentMinor: current.lineMinors.get(defLine.lineId) ?? 0,
      comparativeMinor: comparative ? comparative.lineMinors.get(defLine.lineId) ?? 0 : null,
      accounts: current.accountsByLine.get(defLine.lineId) ?? [],
      mappingRule: defLine.match ?? defLine.formula ?? defLine.computed ?? null,
      displaySign: defLine.displaySign ?? 1,
    })
  );

  const totalAssets = current.lineMinors.get('total-assets') ?? 0;
  const totalLiabilities = current.lineMinors.get('total-liabilities') ?? 0;
  const totalEquity = current.lineMinors.get('total-equity') ?? 0;
  const equationDifference = totalAssets - totalLiabilities - totalEquity;
  const unmappedSigned = current.unmapped.reduce((s, u) => s + closingSigned(u), 0);
  const equationFailures = [...(current.rePolicyWarnings ?? [])];
  if (equationDifference !== 0) {
    equationFailures.push({
      code: 'REP-003',
      message: `Balance Sheet does not balance: Assets − Liabilities − Equity = ${equationDifference} minor units${
        unmappedSigned !== 0 ? ` (unmapped/unclassified account balances total ${unmappedSigned})` : ''
      }. No balancing figure inserted.`,
      differenceMinor: equationDifference,
      affectedAccounts: current.unmapped.map((u) => u.accountId),
    });
  }

  const envelope = buildReportEnvelope(context, request, definition, {
    drillDownBasis: 'AS_OF',
    lines,
    totals: {
      totalAssets: amount(totalAssets),
      totalLiabilities: amount(totalLiabilities),
      totalEquity: amount(totalEquity),
      totalLiabilitiesAndEquity: amount(current.lineMinors.get('total-liabilities-equity') ?? 0),
      currentYearEarnings: amount(current.currentYearEarningsMinor),
      retainedEarnings: amount(current.retainedEarningsMinor),
      equationDifference: amount(equationDifference),
      balanced: equationDifference === 0,
    },
    unresolvedExceptions: exceptions,
  });
  return finalizeEnvelope(envelope, {
    unmapped: current.unmapped,
    assisted: current.assisted,
    exceptionalHeaders: current.exceptionalHeaders,
    ledgerAnomalies: current.cumulative.anomalies ?? [],
    equationFailures,
  });
}

/* ── Cash Flow Statement (indirect method) ────────────────────────────────── */

function cashFlowBucket(profile) {
  if (profile.cashFlow === 'OPERATING' || profile.cashFlow === 'INVESTING' || profile.cashFlow === 'FINANCING') {
    return profile.cashFlow;
  }
  if (profile.isPnl) return 'NET_PROFIT';
  if (profile.category === 'ASSET') {
    // Accumulated depreciation stays OPERATING: its movement is the classic
    // indirect-method depreciation add-back, not an investing flow.
    const investing = ['FIXED_ASSET', 'PROPERTY_PLANT_EQUIPMENT', 'PPE', 'INTANGIBLE', 'INVESTMENT', 'NON_CURRENT_ASSET'];
    if (investing.includes(profile.subType) || (!profile.subType && profile.assist.fixedAsset && !profile.assist.accumulatedDepreciation)) {
      return 'INVESTING';
    }
    return 'OPERATING';
  }
  if (profile.category === 'LIABILITY') {
    const financing = ['LOAN', 'LONG_TERM_LOAN', 'CURRENT_LOAN', 'BORROWING', 'LEASE_LIABILITY'];
    if (financing.includes(profile.subType) || (!profile.subType && profile.assist.loan)) return 'FINANCING';
    return 'OPERATING';
  }
  if (profile.category === 'EQUITY') return 'FINANCING';
  return 'OPERATING';
}

export async function generateCashFlow(db, context, request) {
  const definition = getReportDefinition('CASH_FLOW', request.reportDefinitionVersion);
  const summary = await getBusinessLedgerSummary(db, context, {
    startDate: request.fromDate ?? undefined,
    endDate: request.toDate ?? undefined,
    branchId: request.branchId ?? null,
    includeZeroActivity: false,
  });
  const exceptions = await loadOpenAccountingExceptions(db, context);

  let openingCash = 0;
  let cashMovement = 0;
  let netProfitContribution = 0;
  const buckets = { OPERATING: [], INVESTING: [], FINANCING: [] };
  const cashAccounts = [];

  const exceptionalHeaders = [];
  for (const r of summary.accounts) {
    if (!isAmountBearingAccount(r)) continue;
    if (r.exceptionalPostingAccount) {
      exceptionalHeaders.push({
        accountId: r.accountId,
        accountCode: r.accountCode,
        lineId: 'cash-flow',
      });
    }
    const profile = resolveAccountProfile(r);
    if (profile.isCash) {
      openingCash += openingSigned(r);
      cashMovement += movementSigned(r);
      cashAccounts.push(accountRef(r, movementSigned(r)));
      continue;
    }
    const contribution = -movementSigned(r); // double entry: Δcash = −Σ Δ(non-cash)
    if (contribution === 0) continue;
    const bucket = cashFlowBucket(profile);
    if (bucket === 'NET_PROFIT') {
      netProfitContribution += contribution;
    } else {
      buckets[bucket].push(accountRef(r, contribution));
    }
  }

  const sum = (refs) => refs.reduce((s, x) => s + x.amount.minor, 0);
  const workingCapitalMinor = sum(buckets.OPERATING);
  const operatingMinor = netProfitContribution + workingCapitalMinor;
  const investingMinor = sum(buckets.INVESTING);
  const financingMinor = sum(buckets.FINANCING);
  const netMovementMinor = operatingMinor + investingMinor + financingMinor;
  const closingCash = openingCash + cashMovement;

  const equationFailures = [];
  if (netMovementMinor !== cashMovement) {
    equationFailures.push({
      code: 'REP-004',
      message: `Classified net cash movement ${netMovementMinor} differs from General Ledger cash movement ${cashMovement}; unclassified counterpart accounts present. No plug figure used.`,
      differenceMinor: netMovementMinor - cashMovement,
    });
  }

  // Bucket contributions are −Δ (credit-positive), so drill-down compares with
  // displaySign −1; the cash-account detail sits on net-movement (Δ, sign +1).
  const mkLine = (o) => buildReportLine(o);
  const lines = [
    mkLine({ lineId: 'net-profit', label: 'Net Profit', lineType: 'CALCULATED_TOTAL', displayOrder: 10, currentMinor: netProfitContribution }),
    mkLine({ lineId: 'working-capital', label: 'Working Capital and Non-cash Movements', lineType: 'ACCOUNT_GROUP', displayOrder: 20, currentMinor: workingCapitalMinor, accounts: buckets.OPERATING, displaySign: -1 }),
    mkLine({ lineId: 'operating', label: 'Net Cash from Operating Activities', lineType: 'SUBTOTAL', displayOrder: 30, currentMinor: operatingMinor }),
    mkLine({ lineId: 'investing', label: 'Net Cash from Investing Activities', lineType: 'ACCOUNT_GROUP', displayOrder: 40, currentMinor: investingMinor, accounts: buckets.INVESTING, displaySign: -1 }),
    mkLine({ lineId: 'financing', label: 'Net Cash from Financing Activities', lineType: 'ACCOUNT_GROUP', displayOrder: 50, currentMinor: financingMinor, accounts: buckets.FINANCING, displaySign: -1 }),
    mkLine({ lineId: 'net-movement', label: 'Net Increase / (Decrease) in Cash', lineType: 'GRAND_TOTAL', displayOrder: 60, currentMinor: netMovementMinor, accounts: cashAccounts }),
    mkLine({ lineId: 'opening-cash', label: 'Opening Cash and Cash Equivalents', lineType: 'CALCULATED_TOTAL', displayOrder: 70, currentMinor: openingCash }),
    mkLine({ lineId: 'closing-cash', label: 'Closing Cash and Cash Equivalents', lineType: 'GRAND_TOTAL', displayOrder: 80, currentMinor: closingCash }),
  ];

  const envelope = buildReportEnvelope(context, request, definition, {
    method: 'INDIRECT',
    drillDownBasis: 'PERIOD',
    lines,
    totals: {
      operating: amount(operatingMinor),
      investing: amount(investingMinor),
      financing: amount(financingMinor),
      netMovement: amount(netMovementMinor),
      openingCash: amount(openingCash),
      closingCash: amount(closingCash),
      glCashMovement: amount(cashMovement),
      reconciles: netMovementMinor === cashMovement,
    },
    unresolvedExceptions: exceptions,
  });
  return finalizeEnvelope(envelope, {
    equationFailures,
    exceptionalHeaders,
    ledgerAnomalies: summary.anomalies ?? [],
  });
}

/* ── Statement of Changes in Equity ───────────────────────────────────────── */

export async function generateEquityStatement(db, context, request) {
  const definition = getReportDefinition('EQUITY_STATEMENT', request.reportDefinitionVersion);
  const summary = await getBusinessLedgerSummary(db, context, {
    startDate: request.fromDate ?? undefined,
    endDate: request.toDate ?? undefined,
    branchId: request.branchId ?? null,
    includeZeroActivity: false,
  });
  const exceptions = await loadOpenAccountingExceptions(db, context);

  let openingEquity = 0;
  let profitForPeriod = 0;
  const components = { CAPITAL: [], DRAWINGS: [], RETAINED_EARNINGS: [], OTHER: [] };

  const exceptionalHeaders = [];
  for (const r of summary.accounts) {
    if (!isAmountBearingAccount(r)) continue;
    if (r.exceptionalPostingAccount) {
      exceptionalHeaders.push({
        accountId: r.accountId,
        accountCode: r.accountCode,
        lineId: 'equity-statement',
      });
    }
    const profile = resolveAccountProfile(r);
    if (profile.isPnl) {
      openingEquity += -openingSigned(r); // accumulated prior P&L is part of opening equity
      profitForPeriod += -movementSigned(r);
      continue;
    }
    if (profile.category !== 'EQUITY') continue;
    openingEquity += -openingSigned(r);
    const moveMinor = -movementSigned(r);
    if (moveMinor === 0) continue;
    const key =
      profile.subType === 'DRAWINGS' || (!profile.subType && profile.assist.drawings)
        ? 'DRAWINGS'
        : profile.subType === 'RETAINED_EARNINGS' || (!profile.subType && profile.assist.retainedEarnings)
          ? 'RETAINED_EARNINGS'
          : ['OWNER_CAPITAL', 'SHARE_CAPITAL', 'CAPITAL_CONTRIBUTION', 'SHARE_PREMIUM'].includes(profile.subType) ||
              (!profile.subType && profile.assist.capital)
            ? 'CAPITAL'
            : 'OTHER';
    components[key].push(accountRef(r, moveMinor));
  }

  const sum = (refs) => refs.reduce((s, x) => s + x.amount.minor, 0);
  const contributionsMinor = sum(components.CAPITAL);
  const drawingsMinor = sum(components.DRAWINGS);
  const reMovementsMinor = sum(components.RETAINED_EARNINGS);
  const otherMinor = sum(components.OTHER);
  const closingEquity =
    openingEquity + contributionsMinor + drawingsMinor + reMovementsMinor + otherMinor + profitForPeriod;

  const lines = [
    buildReportLine({ lineId: 'opening-equity', label: 'Opening Equity', lineType: 'CALCULATED_TOTAL', displayOrder: 10, currentMinor: openingEquity }),
    buildReportLine({ lineId: 'contributions', label: 'Capital Contributions and Share Issues', lineType: 'ACCOUNT_GROUP', displayOrder: 20, currentMinor: contributionsMinor, accounts: components.CAPITAL, displaySign: -1 }),
    buildReportLine({ lineId: 'profit', label: 'Profit / (Loss) for the Period', lineType: 'CALCULATED_TOTAL', displayOrder: 30, currentMinor: profitForPeriod }),
    buildReportLine({ lineId: 'drawings', label: 'Owner Drawings', lineType: 'ACCOUNT_GROUP', displayOrder: 40, currentMinor: drawingsMinor, accounts: components.DRAWINGS, displaySign: -1 }),
    buildReportLine({ lineId: 're-movements', label: 'Retained Earnings Movements (posted)', lineType: 'ACCOUNT_GROUP', displayOrder: 50, currentMinor: reMovementsMinor, accounts: components.RETAINED_EARNINGS, displaySign: -1 }),
    buildReportLine({ lineId: 'other-movements', label: 'Other Equity Movements', lineType: 'ACCOUNT_GROUP', displayOrder: 60, currentMinor: otherMinor, accounts: components.OTHER, displaySign: -1 }),
    buildReportLine({ lineId: 'closing-equity', label: 'Closing Equity', lineType: 'GRAND_TOTAL', displayOrder: 70, currentMinor: closingEquity }),
  ];

  const envelope = buildReportEnvelope(context, request, definition, {
    drillDownBasis: 'PERIOD',
    lines,
    totals: {
      openingEquity: amount(openingEquity),
      contributions: amount(contributionsMinor),
      profitForPeriod: amount(profitForPeriod),
      drawings: amount(drawingsMinor),
      closingEquity: amount(closingEquity),
    },
    unresolvedExceptions: exceptions,
  });
  return finalizeEnvelope(envelope, {
    exceptionalHeaders,
    ledgerAnomalies: summary.anomalies ?? [],
  });
}
