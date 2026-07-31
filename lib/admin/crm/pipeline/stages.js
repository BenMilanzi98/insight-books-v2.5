/**
 * Pipeline stages helpers — Phase 12 Wave 1.
 */

import {
  getDefaultNewBusinessPipelineDefinition,
  getPipelineDefinitionByCode,
  isTerminalStage,
  stageSortOrder,
  canTransitionStage,
} from './definitions.js';
import { CRM_PIPELINE_CODE, CRM_PIPELINE_STAGE } from './catalogue.js';

export function hasCrmPipelineStageModel(prisma) {
  return typeof prisma?.crmPipelineStage?.findMany === 'function';
}

/**
 * Resolve stages for a pipeline (DB version if present, else catalogue).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ pipelineCode?: string, pipelineVersionId?: string|null }} [opts]
 */
export async function listPipelineStages(prisma, opts = {}) {
  const code = String(opts.pipelineCode || CRM_PIPELINE_CODE.NEW_BUSINESS)
    .trim()
    .toUpperCase();
  const def = getPipelineDefinitionByCode(code) || getDefaultNewBusinessPipelineDefinition();

  if (opts.pipelineVersionId && hasCrmPipelineStageModel(prisma)) {
    try {
      const rows = await prisma.crmPipelineStage.findMany({
        where: { pipelineVersionId: String(opts.pipelineVersionId) },
        orderBy: { sortOrder: 'asc' },
      });
      if (rows?.length) {
        return {
          ok: true,
          source: 'db',
          stages: rows.map((r) => ({
            code: r.code,
            name: r.name,
            sortOrder: r.sortOrder,
            terminal: Boolean(r.terminal),
            defaultProbability:
              r.defaultProbability != null ? Number(r.defaultProbability) : null,
            entryCriteria: r.entryCriteria ?? null,
            exitCriteria: r.exitCriteria ?? null,
          })),
        };
      }
    } catch {
      // fall through to catalogue
    }
  }

  return { ok: true, source: 'catalogue', stages: [...def.stages] };
}

/**
 * @param {string} stageCode
 * @param {{ pipelineCode?: string }} [opts]
 */
export function getStageDefinition(stageCode, opts = {}) {
  const code = String(stageCode || '').trim().toUpperCase();
  const def =
    getPipelineDefinitionByCode(opts.pipelineCode) ||
    getDefaultNewBusinessPipelineDefinition();
  return def.stages.find((s) => s.code === code) || null;
}

export {
  isTerminalStage,
  stageSortOrder,
  canTransitionStage,
  CRM_PIPELINE_STAGE,
};
