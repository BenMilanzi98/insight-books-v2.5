/**
 * Pipeline reporting centre — Phase 12 Wave 4.
 * Stage counts, open pipeline by currency (currency-separated; no silent FX),
 * win/loss counts. Never false zeroes — empty → UNAVAILABLE / empty envelope.
 * Weighted totals must not surface as enabled UI (flag OFF until Phase 16).
 */

import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import {
  CRM_PIPELINE_CODES,
  CRM_PIPELINE_STAGES_ORDERED,
  CRM_PIPELINE_TERMINAL_STAGES,
  CRM_OPPORTUNITY_STATUS,
} from '../pipeline/catalogue.js';
import {
  WEIGHTED_PIPELINE_UI_ENABLED,
  resolveWeightedPipelineUiAccess,
  summarizeAmountsByCurrency,
  computeIndicativeWeightedAmount,
} from './commercial.js';
import { hasCrmOpportunityModel } from './model.js';

export const CRM_PIPELINE_REPORT_VERSION = 'crm-pipeline-report-v1-2026-07-30';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   pipelineCode?: string|null,
 * }} args
 */
export async function getPipelineReport(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewPipeline && !access.canViewOpportunities && !access.canExport) {
    return { ok: false, forbidden: true, reason: 'crm_pipeline_report_forbidden' };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied' };
  }

  if (!hasCrmOpportunityModel(prisma)) {
    return {
      ok: true,
      status: 'UNAVAILABLE',
      reason: 'crm_opportunity_model_unavailable',
      report: null,
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        weightedUiEnabled: resolveWeightedPipelineUiAccess({}).unlocked,
        isRevenue: false,
      },
      definitionVersion: CRM_PIPELINE_REPORT_VERSION,
    };
  }

  const pipelineFilter = args.pipelineCode
    ? String(args.pipelineCode).trim().toUpperCase()
    : null;
  if (pipelineFilter && !CRM_PIPELINE_CODES.includes(pipelineFilter)) {
    return { ok: false, error: 'invalid_pipeline_code', allowed: CRM_PIPELINE_CODES };
  }

  let rows = [];
  try {
    const where = {};
    if (pipelineFilter) where.pipelineCode = pipelineFilter;
    where.status = { not: CRM_OPPORTUNITY_STATUS.MERGED };
    rows = await prisma.crmOpportunity.findMany({ where, take: 5000 });
  } catch {
    return {
      ok: true,
      status: 'UNAVAILABLE',
      reason: 'opportunity_query_failed',
      report: null,
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        weightedUiEnabled: resolveWeightedPipelineUiAccess({}).unlocked,
        isRevenue: false,
      },
      definitionVersion: CRM_PIPELINE_REPORT_VERSION,
    };
  }

  if (!rows || rows.length === 0) {
    return {
      ok: true,
      status: 'EMPTY',
      report: {
        stageCounts: null,
        openPipelineByCurrency: null,
        winCount: null,
        lossCount: null,
        openCount: null,
        totalCount: null,
        weightedTotals: null,
      },
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        emptyEnvelope: true,
        weightedUiEnabled: resolveWeightedPipelineUiAccess({}).unlocked,
        isRevenue: false,
        fxConverted: false,
      },
      definitionVersion: CRM_PIPELINE_REPORT_VERSION,
      meta: {
        pipelineCode: pipelineFilter,
        scopeMode: scope.mode,
        scopeStub: scope.stub === true,
      },
    };
  }

  const stageCounts = Object.create(null);
  for (const code of CRM_PIPELINE_STAGES_ORDERED) {
    stageCounts[code] = 0;
  }

  let winCount = 0;
  let lossCount = 0;
  let openCount = 0;
  const openLines = [];

  for (const row of rows) {
    const stage = String(row.stageCode || '').toUpperCase();
    if (stageCounts[stage] != null) stageCounts[stage] += 1;
    else stageCounts[stage] = 1;

    const status = String(row.status || '').toUpperCase();
    if (status === CRM_OPPORTUNITY_STATUS.WON) winCount += 1;
    else if (status === CRM_OPPORTUNITY_STATUS.LOST) lossCount += 1;
    else if (status === CRM_OPPORTUNITY_STATUS.OPEN) {
      openCount += 1;
      if (
        row.amount != null &&
        row.currency &&
        !CRM_PIPELINE_TERMINAL_STAGES.includes(stage)
      ) {
        openLines.push({ amount: row.amount, currency: row.currency });
      }
    }
  }

  const openPipelineByCurrency = summarizeAmountsByCurrency(openLines);

  // Phase 16: unlock weighted totals only when honesty + currency gates pass.
  const weightedUi = resolveWeightedPipelineUiAccess({
    honestyOk: true,
    currencyOk: openPipelineByCurrency.ok === true,
  });

  let weightedTotals = null;
  if (weightedUi.unlocked) {
    const weightedLines = [];
    for (const row of rows) {
      if (String(row.status || '').toUpperCase() !== CRM_OPPORTUNITY_STATUS.OPEN) continue;
      const w = computeIndicativeWeightedAmount({
        amount: row.amount,
        probability: row.probability,
        currency: row.currency,
        uiGate: { honestyOk: true, currencyOk: true },
      });
      if (w.ok && w.currency) {
        weightedLines.push({
          amount: w.indicativeWeightedAmount,
          currency: w.currency,
        });
      }
    }
    weightedTotals = summarizeAmountsByCurrency(weightedLines);
    if (weightedTotals && typeof weightedTotals === 'object') {
      weightedTotals.isRevenue = false;
      weightedTotals.isIndicativeOnly = true;
      weightedTotals.weightedUiEnabled = true;
    }
  } else {
    weightedTotals = {
      status: 'NOT_AVAILABLE',
      reason: weightedUi.reason || 'weighted_pipeline_ui_gated',
      weightedUiEnabled: false,
      byCurrency: null,
      isRevenue: false,
      isIndicativeOnly: true,
      capabilityEnabled: WEIGHTED_PIPELINE_UI_ENABLED === true,
    };
  }

  return {
    ok: true,
    status: 'READY',
    report: {
      stageCounts,
      openPipelineByCurrency,
      winCount,
      lossCount,
      openCount,
      totalCount: rows.length,
      weightedTotals,
    },
    honesty: {
      inventZeroesForbidden: true,
      falseZeroes: false,
      emptyEnvelope: false,
      weightedUiEnabled: weightedUi.unlocked,
      isRevenue: false,
      fxConverted: false,
      phase6RevenueForbidden: true,
    },
    definitionVersion: CRM_PIPELINE_REPORT_VERSION,
    meta: {
      pipelineCode: pipelineFilter,
      scopeMode: scope.mode,
      scopeStub: scope.stub === true,
      catalogueCodes: CRM_PIPELINE_CODES,
    },
  };
}
