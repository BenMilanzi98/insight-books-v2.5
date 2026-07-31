/**
 * Pipeline board — Phase 12 Wave 3.
 * Bounded page size per column; permission-scoped; weighted UI dark.
 */

import { CRM_LIST_DEFAULT_LIMIT } from '../catalogue.js';
import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import { CRM_PIPELINE_STAGES_ORDERED } from '../pipeline/catalogue.js';
import { getDefaultNewBusinessPipelineDefinition } from '../pipeline/definitions.js';
import {
  WEIGHTED_PIPELINE_UI_ENABLED,
  resolveWeightedPipelineUiAccess,
} from './commercial.js';
import { hasCrmOpportunityModel, serializeOpportunity } from './model.js';

/** Max cards fetched per stage column (board). */
export const BOARD_COLUMN_PAGE_SIZE = 25;

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   pipelineCode?: string,
 *   ownerAdminId?: string|null,
 *   myPipeline?: boolean,
 *   columnLimit?: number|string,
 * }} args
 */
export async function getPipelineBoard(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewPipeline && !access.canViewOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_pipeline_view_forbidden' };
  }

  if (!hasCrmOpportunityModel(prisma)) {
    return {
      ok: false,
      error: 'crm_opportunity_model_unavailable',
      status: 'UNAVAILABLE',
      columns: [],
    };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied', columns: [] };
  }

  let columnLimit = Number.parseInt(String(args.columnLimit ?? BOARD_COLUMN_PAGE_SIZE), 10);
  if (!Number.isFinite(columnLimit) || columnLimit < 1) columnLimit = BOARD_COLUMN_PAGE_SIZE;
  if (columnLimit > BOARD_COLUMN_PAGE_SIZE) columnLimit = BOARD_COLUMN_PAGE_SIZE;

  const definition = getDefaultNewBusinessPipelineDefinition();
  const stages = definition.stages || [];

  let ownerFilter = null;
  if (args.myPipeline === true && args.admin?.id) {
    ownerFilter = String(args.admin.id);
  } else if (args.ownerAdminId) {
    ownerFilter = String(args.ownerAdminId).trim();
  }

  const columns = [];
  for (const stage of stages) {
    const where = { stageCode: stage.code };
    if (ownerFilter) where.ownerAdminId = ownerFilter;

    let rows = [];
    let totalInStage = null;
    try {
      rows = await prisma.crmOpportunity.findMany({
        where,
        take: columnLimit,
        orderBy: { updatedAt: 'desc' },
      });
      if (typeof prisma.crmOpportunity.count === 'function') {
        totalInStage = await prisma.crmOpportunity.count({ where });
      }
    } catch {
      rows = [];
    }

    columns.push({
      stageCode: stage.code,
      stageName: stage.name,
      sortOrder: stage.sortOrder,
      terminal: Boolean(stage.terminal),
      items: (rows || []).map(serializeOpportunity),
      meta: {
        count: (rows || []).length,
        limit: columnLimit,
        totalInStage,
        truncated:
          totalInStage != null ? totalInStage > columnLimit : (rows || []).length >= columnLimit,
      },
    });
  }

  return {
    ok: true,
    pipelineCode: definition.code,
    pipelineVersion: definition.version,
    columns,
    stageOrder: [...CRM_PIPELINE_STAGES_ORDERED],
    meta: {
      columnLimit,
      scopeMode: scope.mode,
      scopeStub: scope.stub === true,
      // Board never silently unlocks weighted UI without currency honesty.
      weightedUiEnabled: resolveWeightedPipelineUiAccess({
        honestyOk: true,
        currencyOk: false,
      }).unlocked,
      weightedUiCapability: WEIGHTED_PIPELINE_UI_ENABLED === true,
      boardDragPersistForbidden: true,
      accessibleNonDragRequired: true,
    },
  };
}

export { CRM_LIST_DEFAULT_LIMIT };
