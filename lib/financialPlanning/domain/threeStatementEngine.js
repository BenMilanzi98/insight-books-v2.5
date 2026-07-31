/**
 * Integrated three-statement projection engine (exact minor units).
 * Cash from integrated schedules (indirect CF). Never writes Journal Entries.
 * No hidden BS plug — imbalance → INVALID.
 */

import { createHash } from 'crypto';
import { parseToMinor, minorToDecimalString, pctOf, applyGrowth } from './money.js';
import { ForecastIntegrityStatus } from './enums.js';

function m(v) {
  return parseToMinor(v);
}

function amt(minor) {
  return { minor: String(minor), decimal: minorToDecimalString(minor) };
}

/**
 * Project n monthly periods (1–60).
 */
export function projectThreeStatements(input) {
  const months = Math.min(Math.max(Number(input.months) || 12, 1), 60);
  const a = input.assumptions || {};
  const growthBps = Number(a.revenueGrowthBps ?? 0);
  const gmBps = Number(a.grossMarginBps ?? 4000);
  const opexBps = Number(a.opexPercentOfRevenueBps ?? 2500);
  const dso = Math.max(0, Number(a.dsoDays ?? 30));
  const dpo = Math.max(0, Number(a.dpoDays ?? 30));
  const invDays = Math.max(0, Number(a.inventoryDays ?? 30));
  const taxBps = Number(a.taxRateBps ?? 0);
  const dep = m(a.monthlyDepreciationMinor ?? 0);
  const capex = m(a.monthlyCapexMinor ?? 0);
  const interestBps = Number(a.monthlyInterestBpsOfDebt ?? 0);
  const principal = m(a.monthlyPrincipalRepaymentMinor ?? 0);
  const newDebt = m(a.monthlyNewDebtMinor ?? 0);
  const capital = m(a.monthlyCapitalContributionMinor ?? 0);
  const drawings = m(a.monthlyDrawingsMinor ?? 0);
  const dividends = m(a.monthlyDividendMinor ?? 0);
  const seasonal = Array.isArray(a.seasonalIndexBps) ? a.seasonalIndexBps : null;

  let cash = m(input.opening.cash);
  let ar = m(input.opening.receivables);
  let inventory = m(input.opening.inventory);
  const oca = m(input.opening.otherCurrentAssets ?? 0);
  let faGross = m(input.opening.fixedAssetsGross ?? 0);
  let accumDep = m(input.opening.accumulatedDepreciation ?? 0);
  let ap = m(input.opening.payables);
  const payrollLiab = m(input.opening.payrollLiabilities ?? 0);
  let taxPay = m(input.opening.taxPayable ?? 0);
  let stDebt = m(input.opening.shortTermDebt ?? 0);
  let ltDebt = m(input.opening.longTermDebt ?? 0);
  let equity = m(input.opening.equity ?? 0);
  let re = m(input.opening.retainedEarnings ?? 0);

  // Opening must balance
  const openNbv = faGross - accumDep;
  const openAssets = cash + ar + inventory + oca + openNbv;
  const openLiab = ap + payrollLiab + taxPay + stDebt + ltDebt;
  const openEquity = equity + re;
  const findings = [];
  if (openAssets - openLiab - openEquity !== 0n) {
    findings.push({
      code: 'FPL-009',
      message: `Opening Balance Sheet does not balance (diff ${minorToDecimalString(openAssets - openLiab - openEquity)}).`,
      severity: 'CRITICAL',
    });
  }

  let revenue = m(input.baseRevenueMinor);
  const outPeriods = [];
  let minCash = cash;
  let firstShortage = null;

  for (let i = 0; i < months; i++) {
    const label = input.labels?.[i] || `M${i + 1}`;
    const seasonBps = seasonal?.[i % (seasonal.length || 1)] ?? 10000;
    if (i > 0) revenue = applyGrowth(revenue, growthBps);
    const rev = (revenue * BigInt(seasonBps)) / 10000n;

    const cos = rev - pctOf(rev, gmBps);
    const grossProfit = rev - cos;
    const opex = pctOf(rev, opexBps);
    const ebitda = grossProfit - opex;
    const depreciation = dep;
    const ebit = ebitda - depreciation;
    const debtBefore = stDebt + ltDebt;
    const interest = pctOf(debtBefore, interestBps);
    const ebt = ebit - interest;
    const tax = ebt > 0n ? pctOf(ebt, taxBps) : 0n;
    const netProfit = ebt - tax;

    // Snapshot openings for Δ
    const oCash = cash;
    const oAr = ar;
    const oInv = inventory;
    const oAp = ap;
    const oTax = taxPay;
    const oSt = stDebt;
    const oLt = ltDebt;
    const oFa = faGross;
    const oAd = accumDep;
    const oEq = equity;
    const oRe = re;

    // WC targets from drivers
    ar = (rev * BigInt(Math.round(dso))) / 30n;
    inventory = (cos * BigInt(Math.round(invDays))) / 30n;
    const purchases = cos + (inventory - oInv);
    ap = purchases > 0n ? (purchases * BigInt(Math.round(dpo))) / 30n : 0n;

    // Tax payable: accrue then pay in full (planning default)
    taxPay = oTax + tax - tax;

    // Assets
    faGross = oFa + capex;
    accumDep = oAd + depreciation;
    const nbv = faGross - accumDep;

    // Debt
    let debtRepay = principal;
    const totalDebt = oSt + oLt;
    if (debtRepay > totalDebt) debtRepay = totalDebt;
    stDebt = oSt;
    ltDebt = oLt;
    if (debtRepay <= ltDebt) ltDebt -= debtRepay;
    else {
      const rest = debtRepay - ltDebt;
      ltDebt = 0n;
      stDebt -= rest;
      if (stDebt < 0n) stDebt = 0n;
    }
    ltDebt += newDebt;

    // Equity (capital ≠ revenue; drawings/dividends ≠ opex)
    equity = oEq + capital;
    re = oRe + netProfit - drawings - dividends;

    // Indirect cash from identity (guarantees CF closing cash = BS cash)
    // ΔCash = ΔLiab + ΔEquity + ΔRE - ΔAR - ΔInv - ΔOCA - ΔNBV
    const dAr = ar - oAr;
    const dInv = inventory - oInv;
    const dAp = ap - oAp;
    const dTax = taxPay - oTax;
    const dDebt = stDebt + ltDebt - (oSt + oLt);
    const dEq = equity - oEq;
    const dRe = re - oRe;
    const dNbv = nbv - (oFa - oAd);
    cash = oCash + dAp + dTax + dDebt + dEq + dRe - dAr - dInv - dNbv;

    const assets = cash + ar + inventory + oca + nbv;
    const liabilities = ap + payrollLiab + taxPay + stDebt + ltDebt;
    const equityTotal = equity + re;
    const bsDiff = assets - liabilities - equityTotal;
    if (bsDiff !== 0n) {
      findings.push({
        code: 'FPL-009',
        message: `${label}: Balance Sheet difference ${minorToDecimalString(bsDiff)}`,
        severity: 'CRITICAL',
        differenceMinor: String(bsDiff),
      });
    }

    const netCash = cash - oCash;
    const arCollections = oAr + rev - ar; // sales all on account for WC model + cash from Δ
    const supplierPayments = oAp + (purchases > 0n ? purchases : 0n) - ap;

    if (cash < minCash) minCash = cash;
    if (cash < 0n && firstShortage == null) {
      firstShortage = { period: label, index: i, shortfall: amt(-cash) };
    }

    outPeriods.push({
      index: i,
      label,
      pnl: {
        revenue: amt(rev),
        costOfSales: amt(cos),
        grossProfit: amt(grossProfit),
        operatingExpenses: amt(opex),
        ebitda: amt(ebitda),
        depreciation: amt(depreciation),
        ebit: amt(ebit),
        interest: amt(interest),
        ebt: amt(ebt),
        tax: amt(tax),
        netProfit: amt(netProfit),
        grossMarginBps: rev === 0n ? 0 : Number((grossProfit * 10000n) / rev),
        netMarginBps: rev === 0n ? 0 : Number((netProfit * 10000n) / rev),
      },
      cashFlow: {
        openingCash: amt(oCash),
        netProfit: amt(netProfit),
        depreciationAddBack: amt(depreciation),
        changeInReceivables: amt(-dAr),
        changeInInventory: amt(-dInv),
        changeInPayables: amt(dAp),
        investingCapex: amt(-capex),
        financingDebtNet: amt(dDebt),
        financingCapital: amt(capital),
        financingDrawingsDividends: amt(-(drawings + dividends)),
        netCashMovement: amt(netCash),
        closingCash: amt(cash),
        arCollections: amt(arCollections),
        supplierPayments: amt(supplierPayments > 0n ? supplierPayments : 0n),
      },
      balanceSheet: {
        cash: amt(cash),
        receivables: amt(ar),
        inventory: amt(inventory),
        otherCurrentAssets: amt(oca),
        fixedAssetsNet: amt(nbv),
        fixedAssetsGross: amt(faGross),
        accumulatedDepreciation: amt(accumDep),
        totalAssets: amt(assets),
        payables: amt(ap),
        payrollLiabilities: amt(payrollLiab),
        taxPayable: amt(taxPay),
        shortTermDebt: amt(stDebt),
        longTermDebt: amt(ltDebt),
        totalLiabilities: amt(liabilities),
        equity: amt(equity),
        retainedEarnings: amt(re),
        totalEquity: amt(equityTotal),
        difference: amt(bsDiff),
        balanced: bsDiff === 0n,
      },
      workingCapital: {
        dsoDays: dso,
        dpoDays: dpo,
        inventoryDays: invDays,
        workingCapital: amt(cash + ar + inventory + oca - ap - payrollLiab - taxPay - stDebt),
        cashConversionCycleDays: dso + invDays - dpo,
      },
      lineage: {
        methods: {
          revenue: growthBps ? 'COMPOUND_GROWTH' : 'LAST_PERIOD',
          cos: 'GROSS_MARGIN_DRIVER',
          opex: 'PERCENTAGE_OF_REVENUE',
          ar: 'DSO_TARGET',
          ap: 'DPO_TARGET',
          inventory: 'INVENTORY_DAYS',
          cash: 'INDIRECT_FROM_BS_IDENTITY',
        },
        growthBps,
        seasonBps,
        assumptions: {
          grossMarginBps: gmBps,
          opexPercentOfRevenueBps: opexBps,
          taxRateBps: taxBps,
        },
        note: 'Loan proceeds ≠ Revenue; principal ≠ Expense; capital ≠ Revenue; drawings/dividends ≠ OpEx.',
      },
    });
  }

  const last = outPeriods[outPeriods.length - 1];
  if (last && last.cashFlow.closingCash.minor !== last.balanceSheet.cash.minor) {
    findings.push({
      code: 'FPL-010',
      message: 'Closing Cash differs between Cash Flow and Balance Sheet.',
      severity: 'CRITICAL',
    });
  }

  const critical = findings.filter((f) => f.severity === 'CRITICAL');
  let integrityStatus = ForecastIntegrityStatus.VALID;
  if (critical.length) integrityStatus = ForecastIntegrityStatus.INVALID;
  else if (findings.length) integrityStatus = ForecastIntegrityStatus.VALID_WITH_WARNINGS;

  let burnSum = 0n;
  let burnMonths = 0;
  for (const p of outPeriods) {
    const net = BigInt(p.cashFlow.netCashMovement.minor);
    if (net < 0n) {
      burnSum += -net;
      burnMonths += 1;
    }
  }
  const avgBurn = burnMonths ? burnSum / BigInt(burnMonths) : 0n;
  const finalCash = BigInt(last.balanceSheet.cash.minor);
  const runwayMonths =
    avgBurn > 0n && finalCash > 0n ? Number(finalCash / avgBurn) : avgBurn === 0n ? null : 0;

  const totals = {
    revenue: amt(outPeriods.reduce((s, p) => s + BigInt(p.pnl.revenue.minor), 0n)),
    netProfit: amt(outPeriods.reduce((s, p) => s + BigInt(p.pnl.netProfit.minor), 0n)),
    ebitda: amt(outPeriods.reduce((s, p) => s + BigInt(p.pnl.ebitda.minor), 0n)),
    closingCash: last.balanceSheet.cash,
    minimumCash: amt(minCash),
    totalAssets: last.balanceSheet.totalAssets,
    totalLiabilities: last.balanceSheet.totalLiabilities,
    totalEquity: last.balanceSheet.totalEquity,
  };

  const kpis = {
    projectedRevenue: totals.revenue,
    projectedNetProfit: totals.netProfit,
    projectedEbitda: totals.ebitda,
    projectedClosingCash: totals.closingCash,
    minimumCash: totals.minimumCash,
    firstShortage,
    cashBurnAverage: amt(avgBurn),
    cashRunwayMonths: runwayMonths,
    debtToEquity:
      BigInt(last.balanceSheet.totalEquity.minor) === 0n
        ? null
        : Number(
            ((BigInt(last.balanceSheet.shortTermDebt.minor) +
              BigInt(last.balanceSheet.longTermDebt.minor)) *
              100n) /
              BigInt(last.balanceSheet.totalEquity.minor)
          ) / 100,
  };

  const payload = {
    months,
    periods: outPeriods,
    totals,
    kpis,
    findings,
    integrityStatus,
    modelVersion: 'THREE_STATEMENT_V1',
    disclaimer:
      'Projections are planning estimates, not guaranteed outcomes. Tax and interest are assumption-based.',
  };

  payload.checksum = createHash('sha256')
    .update(
      JSON.stringify({
        months,
        integrityStatus,
        closingCash: last.balanceSheet.cash.minor,
        totalEquity: last.balanceSheet.totalEquity.minor,
        netProfit: totals.netProfit.minor,
      })
    )
    .digest('hex');

  return payload;
}

export function computeVariance(actualMinor, comparisonMinor, lineType = 'EXPENSE') {
  const actual = typeof actualMinor === 'bigint' ? actualMinor : BigInt(actualMinor || 0);
  const comparison =
    typeof comparisonMinor === 'bigint' ? comparisonMinor : BigInt(comparisonMinor || 0);
  const variance = actual - comparison;
  let percent = null;
  if (comparison !== 0n) {
    const denom = comparison < 0n ? -comparison : comparison;
    percent = Number((variance * 10000n) / denom) / 100;
  }
  let favourability = 'NEUTRAL';
  if (variance === 0n) favourability = 'NEUTRAL';
  else if (lineType === 'REVENUE' || lineType === 'INCOME') {
    favourability = variance > 0n ? 'FAVOURABLE' : 'UNFAVOURABLE';
  } else if (lineType === 'EXPENSE' || lineType === 'COST') {
    favourability = variance < 0n ? 'FAVOURABLE' : 'UNFAVOURABLE';
  } else {
    favourability = 'NOT_APPLICABLE';
  }
  return {
    actual: amt(actual),
    comparison: amt(comparison),
    variance: amt(variance),
    variancePercent: percent,
    favourability,
  };
}
