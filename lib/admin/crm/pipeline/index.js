/**
 * Pipeline public surface — Phase 12 Wave 1.
 */

import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import {
  CRM_PIPELINE_CODE,
  CRM_PIPELINE_CODES,
  CRM_PIPELINE_DEFINITION_VERSION,
  CRM_PIPELINE_EXPANSION_VERSION,
  CRM_PIPELINE_MRA_EIS_VERSION,
  CRM_PIPELINE_STAGE,
  CRM_PIPELINE_STAGES_ORDERED,
  CRM_PIPELINE_STATUS,
  CRM_PIPELINE_TERMINAL_STAGES,
  CRM_OPPORTUNITY_STATUS,
  CRM_HANDOFF_TYPE_OPPORTUNITY,
} from './catalogue.js';
import {
  getDefaultNewBusinessPipelineDefinition,
  getDefaultExpansionPipelineDefinition,
  getDefaultMraEisPipelineDefinition,
  listCataloguePipelineDefinitions,
  getPipelineDefinitionByCode,
  canTransitionStage,
  isTerminalStage,
  stageSortOrder,
} from './definitions.js';
import {
  listPipelineStages,
  getStageDefinition,
  hasCrmPipelineStageModel,
} from './stages.js';
import {
  transitionOpportunityStage,
  hasCrmOpportunityModel,
  hasCrmOpportunityStageHistoryModel,
  serializeOpportunity,
} from './transition.js';

export function hasCrmPipelineModel(prisma) {
  return typeof prisma?.crmPipeline?.findMany === 'function';
}

export function hasCrmPipelineVersionModel(prisma) {
  return typeof prisma?.crmPipelineVersion?.findFirst === 'function';
}

/**
 * List Pipelines (catalogue fallback when DB empty / EPERM).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object }} args
 */
export async function listPipelines(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewPipeline) {
    return { ok: false, forbidden: true, reason: 'crm_pipeline_view_forbidden' };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied' };
  }

  /** @type {Map<string, object>} */
  const byCode = new Map();

  if (hasCrmPipelineModel(prisma)) {
    try {
      const rows = await prisma.crmPipeline.findMany({});
      for (const p of rows || []) {
        let version = null;
        if (hasCrmPipelineVersionModel(prisma)) {
          version = await prisma.crmPipelineVersion.findFirst({
            where: { pipelineId: p.id, status: CRM_PIPELINE_STATUS.ACTIVE },
          });
        }
        const stagesRes = await listPipelineStages(prisma, {
          pipelineCode: p.code,
          pipelineVersionId: version?.id || null,
        });
        byCode.set(String(p.code).toUpperCase(), {
          id: p.id,
          code: p.code,
          name: p.name,
          status: p.status || CRM_PIPELINE_STATUS.ACTIVE,
          version: version?.versionId || version?.version || null,
          versionId: version?.id || null,
          stages: stagesRes.stages,
          source: 'db',
          weightedUiEnabled: false,
        });
      }
    } catch {
      // fall through to catalogue
    }
  }

  // Always surface ACTIVE catalogue pipelines (NEW_BUSINESS / EXPANSION / MRA_EIS).
  for (const def of listCataloguePipelineDefinitions()) {
    if (!byCode.has(def.code)) {
      byCode.set(def.code, { ...def });
    }
  }

  const items = CRM_PIPELINE_CODES.map((code) => byCode.get(code)).filter(Boolean);

  return {
    ok: true,
    items,
    meta: {
      scopeMode: scope.mode,
      scopeStub: scope.stub === true,
      weightedUiEnabled: false,
      definitionVersion: CRM_PIPELINE_DEFINITION_VERSION,
      expansionVersion: CRM_PIPELINE_EXPANSION_VERSION,
      mraEisVersion: CRM_PIPELINE_MRA_EIS_VERSION,
      catalogueCodes: CRM_PIPELINE_CODES,
    },
  };
}

/**
 * Get Pipeline by id or code.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, id: string }} args
 */
export async function getPipeline(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewPipeline) {
    return { ok: false, forbidden: true, reason: 'crm_pipeline_view_forbidden' };
  }

  const id = args.id ? String(args.id).trim() : '';
  if (!id) return { ok: false, error: 'id_required' };

  if (hasCrmPipelineModel(prisma)) {
    try {
      let row =
        (await prisma.crmPipeline.findUnique({ where: { id } }).catch(() => null)) ||
        (await prisma.crmPipeline.findUnique({ where: { code: id.toUpperCase() } }).catch(
          () => null
        ));
      if (row) {
        let version = null;
        if (hasCrmPipelineVersionModel(prisma)) {
          version = await prisma.crmPipelineVersion.findFirst({
            where: { pipelineId: row.id, status: CRM_PIPELINE_STATUS.ACTIVE },
          });
        }
        const stagesRes = await listPipelineStages(prisma, {
          pipelineCode: row.code,
          pipelineVersionId: version?.id || null,
        });
        return {
          ok: true,
          pipeline: {
            id: row.id,
            code: row.code,
            name: row.name,
            status: row.status,
            version: version?.versionId || version?.version || null,
            versionId: version?.id || null,
            stages: stagesRes.stages,
            source: 'db',
            weightedUiEnabled: false,
          },
        };
      }
    } catch {
      // catalogue fallback
    }
  }

  const def = getPipelineDefinitionByCode(id) || getPipelineDefinitionByCode(id.toUpperCase());
  if (!def) return { ok: false, notFound: true, error: 'pipeline_not_found' };
  return { ok: true, pipeline: { ...def } };
}

export {
  CRM_PIPELINE_CODE,
  CRM_PIPELINE_CODES,
  CRM_PIPELINE_DEFINITION_VERSION,
  CRM_PIPELINE_EXPANSION_VERSION,
  CRM_PIPELINE_MRA_EIS_VERSION,
  CRM_PIPELINE_STAGE,
  CRM_PIPELINE_STAGES_ORDERED,
  CRM_PIPELINE_STATUS,
  CRM_PIPELINE_TERMINAL_STAGES,
  CRM_OPPORTUNITY_STATUS,
  CRM_HANDOFF_TYPE_OPPORTUNITY,
  getDefaultNewBusinessPipelineDefinition,
  getDefaultExpansionPipelineDefinition,
  getDefaultMraEisPipelineDefinition,
  listCataloguePipelineDefinitions,
  getPipelineDefinitionByCode,
  canTransitionStage,
  isTerminalStage,
  stageSortOrder,
  listPipelineStages,
  getStageDefinition,
  hasCrmPipelineStageModel,
  transitionOpportunityStage,
  hasCrmOpportunityModel,
  hasCrmOpportunityStageHistoryModel,
  serializeOpportunity,
};
