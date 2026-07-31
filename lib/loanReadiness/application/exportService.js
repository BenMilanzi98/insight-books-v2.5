import { getAssessmentVersion } from './assessmentService.js';
import { ADVISORY_DISCLAIMER } from '../domain/enums.js';
import { DEFAULT_DOCUMENT_CHECKLIST } from '../domain/documentChecklist.js';

export async function exportLenderPackage(db, context, assessmentVersionId, { format = 'json' } = {}) {
  const tenantId = context.businessId;
  const version = await getAssessmentVersion(db, tenantId, assessmentVersionId);
  const result = version.resultPayload || {};

  const pack = {
    title: 'Loan Readiness / Lender Financial Pack',
    businessId: tenantId,
    assessmentVersionId: version.id,
    assessmentName: version.name,
    status: version.status,
    integrityStatus: version.integrityStatus,
    totalReadinessScore: version.totalReadinessScore,
    confidence: version.confidence,
    band: result.score?.band,
    scoreDimensions: result.score?.dimensions,
    debtCapacity: result.debtCapacity,
    dscrSummary: result.dscr?.summary,
    proposedScheduleTotals: result.proposedSchedule?.totals,
    covenants: result.covenants,
    risks: result.risks,
    recommendations: result.recommendations,
    dataQuality: result.dataQuality,
    documentReadiness: result.documentReadiness,
    collateralReadiness: result.collateralReadiness,
    modelVersions: result.modelVersions,
    sourceVersions: result.sourceVersions,
    disclaimer: ADVISORY_DISCLAIMER,
    notALenderDecision: true,
    notAGuarantee: true,
    neverPostsToGl: true,
    generatedAt: new Date().toISOString(),
    checksum: version.checksum || result.checksum,
  };

  if (format === 'json') {
    return { contentType: 'application/json', filename: `lender-pack-${version.id}.json`, body: pack };
  }

  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'InsightBooks Loan Readiness';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Executive Summary');
  summary.addRow(['Loan Readiness Assessment']);
  summary.addRow(['Disclaimer', ADVISORY_DISCLAIMER]);
  summary.addRow(['Score', pack.totalReadinessScore]);
  summary.addRow(['Band', pack.band]);
  summary.addRow(['Confidence', pack.confidence]);
  summary.addRow(['Integrity', pack.integrityStatus]);
  summary.addRow([
    'Indicative max principal',
    pack.debtCapacity?.indicativeMaximumPrincipal?.decimal,
  ]);
  summary.addRow(['Affordability', pack.debtCapacity?.affordabilityStatus]);
  summary.addRow(['Min projected DSCR', pack.dscrSummary?.minimumDscrObserved]);
  summary.addRow(['Checksum', pack.checksum]);

  const dims = workbook.addWorksheet('Score Dimensions');
  dims.addRow(['Dimension', 'Weight %', 'Calculated', 'Applied', 'Contribution']);
  for (const d of pack.scoreDimensions || []) {
    dims.addRow([d.key, d.weightPercent, d.calculatedScore, d.appliedScore, d.contribution]);
  }

  const dscr = workbook.addWorksheet('DSCR');
  dscr.addRow(['Period', 'CFADS', 'Total Debt Service', 'DSCR', 'Status']);
  for (const p of result.dscr?.periods || []) {
    dscr.addRow([
      p.label,
      Number(p.cfads?.decimal),
      Number(p.totalDebtService?.decimal),
      p.dscr?.ratio,
      p.status,
    ]);
  }

  const sched = workbook.addWorksheet('Proposed Schedule');
  sched.addRow(['Period', 'Opening', 'Principal', 'Interest', 'Debt Service', 'Closing']);
  for (const l of result.proposedSchedule?.lines || []) {
    sched.addRow([
      l.label,
      Number(l.openingPrincipal?.decimal),
      Number(l.principalRepayment?.decimal),
      Number(l.interest?.decimal),
      Number(l.totalDebtService?.decimal),
      Number(l.closingPrincipal?.decimal),
    ]);
  }

  const risks = workbook.addWorksheet('Risks');
  risks.addRow(['Severity', 'Category', 'Title', 'Description']);
  for (const r of pack.risks || []) {
    risks.addRow([r.severity, r.category, r.title, r.description]);
  }

  const actions = workbook.addWorksheet('Management Actions');
  actions.addRow(['Priority', 'Finding', 'Action']);
  for (const a of pack.recommendations || []) {
    actions.addRow([a.priority, a.finding, a.action]);
  }

  const audit = workbook.addWorksheet('Audit');
  audit.addRow(['Field', 'Value']);
  audit.addRow(['Never Posts To GL', 'true']);
  audit.addRow(['Not A Lender Decision', 'true']);
  audit.addRow(['Prepared By', version.preparedBy]);
  audit.addRow(['Reviewed By', version.reviewedBy]);
  audit.addRow(['Approved By', version.approvedBy]);
  audit.addRow(['Approved At', version.approvedAt?.toISOString?.() || '']);

  const docs = workbook.addWorksheet('Document Checklist');
  docs.addRow(['Key', 'Label', 'Required', 'Status']);
  const docItems = result.documentReadiness?.items || DEFAULT_DOCUMENT_CHECKLIST.map((d) => ({
    ...d,
    status: 'MISSING',
  }));
  for (const d of docItems) {
    docs.addRow([d.key, d.label, d.required ? 'Y' : 'N', d.status || '']);
  }

  // Three-statement with proposed debt (summary)
  const tsp = workbook.addWorksheet('Proposed 3-Statement');
  tsp.addRow(['Period', 'Revenue', 'Interest', 'Net Profit', 'Cash', 'LT Debt', 'BS OK']);
  for (const p of result.proposedFacilityProjection?.periods || []) {
    tsp.addRow([
      p.label,
      Number(p.pnl?.revenue?.decimal),
      Number(p.pnl?.interest?.decimal),
      Number(p.pnl?.netProfit?.decimal),
      Number(p.balanceSheet?.cash?.decimal),
      Number(p.balanceSheet?.longTermDebt?.decimal),
      p.balanceSheet?.balanced ? 'Y' : 'N',
    ]);
  }
  tsp.addRow([]);
  tsp.addRow(['Integration note', result.proposedFacilityProjection?.integration?.note || '']);
  tsp.addRow(['Proceeds as revenue?', String(result.proposedFacilityProjection?.integration?.loanProceedsClassifiedAsRevenue)]);
  tsp.addRow(['Never posts to GL', 'true']);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `lender-pack-${version.id}.xlsx`,
    body: buffer,
    packMeta: { checksum: pack.checksum, score: pack.totalReadinessScore },
  };
}

/**
 * Board / executive pack — same evidence as lender pack plus board framing.
 * Not a branded PDF; Excel board pack with advisory disclaimer.
 */
export async function exportBoardPack(db, context, assessmentVersionId, { format = 'xlsx' } = {}) {
  const tenantId = context.businessId;
  const version = await getAssessmentVersion(db, tenantId, assessmentVersionId);
  const result = version.resultPayload || {};

  if (format === 'json') {
    return {
      contentType: 'application/json',
      filename: `board-pack-${version.id}.json`,
      body: {
        title: 'Loan Readiness Board Pack',
        audience: 'BOARD_EXECUTIVE',
        assessmentVersionId: version.id,
        score: version.totalReadinessScore,
        band: result.score?.band,
        confidence: version.confidence,
        affordability: result.debtCapacity?.affordabilityStatus,
        minDscr: result.dscr?.summary?.minimumDscrObserved,
        covenants: result.covenants,
        risks: result.risks,
        recommendations: result.recommendations,
        documentReadiness: result.documentReadiness,
        proposedFacilityIntegration: result.proposedFacilityProjection?.integration,
        sod: {
          preparedBy: version.preparedBy,
          reviewedBy: version.reviewedBy,
          approvedBy: version.approvedBy,
        },
        disclaimer: ADVISORY_DISCLAIMER,
        notALenderDecision: true,
        neverPostsToGl: true,
        generatedAt: new Date().toISOString(),
        checksum: version.checksum || result.checksum,
      },
    };
  }

  const lender = await exportLenderPackage(db, context, assessmentVersionId, { format: 'xlsx' });
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(lender.body);

  const brief = workbook.addWorksheet('Board Brief');
  brief.addRow(['Loan Readiness — Board Brief']);
  brief.addRow(['Disclaimer', ADVISORY_DISCLAIMER]);
  brief.addRow(['Assessment', version.name]);
  brief.addRow(['Status', version.status]);
  brief.addRow(['Internal score', version.totalReadinessScore]);
  brief.addRow(['Band', result.score?.band]);
  brief.addRow(['Confidence', version.confidence]);
  brief.addRow(['Affordability', result.debtCapacity?.affordabilityStatus]);
  brief.addRow(['Indicative max principal', result.debtCapacity?.indicativeMaximumPrincipal?.decimal]);
  brief.addRow(['Min projected DSCR', result.dscr?.summary?.minimumDscrObserved]);
  brief.addRow(['Document completion %', result.documentReadiness?.completionPercent]);
  brief.addRow(['3-stmt integrity', result.proposedFacilityProjection?.integrityStatus]);
  brief.addRow(['Prepared by', version.preparedBy]);
  brief.addRow(['Reviewed by', version.reviewedBy]);
  brief.addRow(['Approved by', version.approvedBy]);
  brief.addRow([
    'Decision framing',
    'Advisory only — board may authorize outreach; lenders decide independently.',
  ]);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `board-pack-${version.id}.xlsx`,
    body: buffer,
  };
}
