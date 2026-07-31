import { getForecastVersion } from './forecastService.js';

/**
 * Build Excel/JSON export from a persisted forecast version.
 * Totals come from server resultPayload — no independent recalculation.
 */
export async function exportForecastPack(db, context, forecastVersionId, { format = 'json' } = {}) {
  const tenantId = context.businessId;
  const version = await getForecastVersion(db, tenantId, forecastVersionId);
  const result = version.resultPayload || {};
  const pack = {
    businessId: tenantId,
    forecastVersionId: version.id,
    name: version.name,
    status: version.status,
    integrityStatus: version.integrityStatus,
    scenario: version.scenario?.code,
    cycle: version.cycle?.cycleNumber,
    modelVersion: version.modelVersion,
    sourceActualsVersion: version.sourceActualsVersion,
    checksum: version.checksum,
    assumptions: version.assumptionsSnapshot,
    kpis: result.kpis,
    totals: result.totals,
    findings: result.findings,
    periods: result.periods,
    disclaimer:
      result.disclaimer ||
      'Projections are planning estimates, not guaranteed outcomes. Never posted to the General Ledger.',
    neverPostsToGl: true,
    generatedAt: new Date().toISOString(),
  };

  if (format === 'json') {
    return { contentType: 'application/json', filename: `forecast-${version.id}.json`, body: pack };
  }

  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'InsightBooks Financial Planning';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Executive Summary');
  summary.addRow(['Financial Planning Forecast Export']);
  summary.addRow(['Business', pack.businessId]);
  summary.addRow(['Forecast', pack.name]);
  summary.addRow(['Scenario', pack.scenario]);
  summary.addRow(['Status', pack.status]);
  summary.addRow(['Integrity', pack.integrityStatus]);
  summary.addRow(['Model', pack.modelVersion]);
  summary.addRow(['Checksum', pack.checksum]);
  summary.addRow(['Source Actuals Version', pack.sourceActualsVersion]);
  summary.addRow(['Generated At', pack.generatedAt]);
  summary.addRow(['Disclaimer', pack.disclaimer]);

  const assumptions = workbook.addWorksheet('Assumptions');
  assumptions.addRow(['Key', 'Value']);
  for (const [k, v] of Object.entries(pack.assumptions || {})) {
    assumptions.addRow([k, typeof v === 'object' ? JSON.stringify(v) : v]);
  }

  const pnl = workbook.addWorksheet('Projected P&L');
  pnl.addRow(['Period', 'Revenue', 'COS', 'Gross Profit', 'OpEx', 'EBITDA', 'Net Profit']);
  for (const p of pack.periods || []) {
    pnl.addRow([
      p.label,
      num(p.pnl?.revenue),
      num(p.pnl?.costOfSales),
      num(p.pnl?.grossProfit),
      num(p.pnl?.operatingExpenses),
      num(p.pnl?.ebitda),
      num(p.pnl?.netProfit),
    ]);
  }

  const cf = workbook.addWorksheet('Projected Cash Flow');
  cf.addRow(['Period', 'Opening Cash', 'Net Movement', 'Closing Cash', 'Capex', 'Debt Net', 'Capital']);
  for (const p of pack.periods || []) {
    cf.addRow([
      p.label,
      num(p.cashFlow?.openingCash),
      num(p.cashFlow?.netCashMovement),
      num(p.cashFlow?.closingCash),
      num(p.cashFlow?.investingCapex),
      num(p.cashFlow?.financingDebtNet),
      num(p.cashFlow?.financingCapital),
    ]);
  }

  const bs = workbook.addWorksheet('Projected Balance Sheet');
  bs.addRow([
    'Period',
    'Cash',
    'Receivables',
    'Inventory',
    'Fixed Assets Net',
    'Total Assets',
    'Payables',
    'Debt',
    'Equity',
    'RE',
    'Balanced',
  ]);
  for (const p of pack.periods || []) {
    bs.addRow([
      p.label,
      num(p.balanceSheet?.cash),
      num(p.balanceSheet?.receivables),
      num(p.balanceSheet?.inventory),
      num(p.balanceSheet?.fixedAssetsNet),
      num(p.balanceSheet?.totalAssets),
      num(p.balanceSheet?.payables),
      Number(p.balanceSheet?.shortTermDebt?.decimal || 0) +
        Number(p.balanceSheet?.longTermDebt?.decimal || 0),
      num(p.balanceSheet?.equity),
      num(p.balanceSheet?.retainedEarnings),
      p.balanceSheet?.balanced ? 1 : 0,
    ]);
  }

  const kpis = workbook.addWorksheet('KPIs');
  kpis.addRow(['KPI', 'Value']);
  for (const [k, v] of Object.entries(pack.kpis || {})) {
    kpis.addRow([k, v?.decimal ?? (typeof v === 'object' ? JSON.stringify(v) : v)]);
  }

  const integrity = workbook.addWorksheet('Integrity Findings');
  integrity.addRow(['Code', 'Severity', 'Message']);
  for (const f of pack.findings || []) {
    integrity.addRow([f.code, f.severity, f.message]);
  }

  const audit = workbook.addWorksheet('Audit Information');
  audit.addRow(['Field', 'Value']);
  audit.addRow(['Never Posts To GL', 'true']);
  audit.addRow(['Approved By', version.approvedBy]);
  audit.addRow(['Approved At', version.approvedAt?.toISOString?.() || version.approvedAt]);
  audit.addRow(['Prepared By', version.preparedBy]);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `forecast-${version.id}.xlsx`,
    body: buffer,
    packMeta: {
      checksum: pack.checksum,
      integrityStatus: pack.integrityStatus,
      periodCount: (pack.periods || []).length,
    },
  };
}

function num(amt) {
  if (amt == null) return null;
  if (typeof amt === 'number') return amt;
  const d = amt.decimal != null ? Number(amt.decimal) : Number(amt);
  return Number.isFinite(d) ? d : null;
}
