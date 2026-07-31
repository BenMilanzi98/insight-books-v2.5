/**
 * Pipeline definitions — Phase 12 Wave 1 + Wave 4.
 * ACTIVE NEW_BUSINESS / EXPANSION / MRA_EIS catalogue (versioned).
 * Shared stage codes; pipeline-specific entry criteria documented below.
 */

import {
  CRM_PIPELINE_CODE,
  CRM_PIPELINE_DEFINITION_VERSION,
  CRM_PIPELINE_EXPANSION_VERSION,
  CRM_PIPELINE_MRA_EIS_VERSION,
  CRM_PIPELINE_STAGE,
  CRM_PIPELINE_STAGES_ORDERED,
  CRM_PIPELINE_STATUS,
  CRM_PIPELINE_TERMINAL_STAGES,
} from './catalogue.js';

const STAGE_META = Object.freeze({
  [CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED]: {
    name: 'Opportunity Identified',
    defaultProbability: 10,
    entryCriteria: Object.freeze(['handoff_ready']),
    exitCriteria: Object.freeze(['discovery_started']),
  },
  [CRM_PIPELINE_STAGE.DISCOVERY]: {
    name: 'Discovery',
    defaultProbability: 20,
    entryCriteria: Object.freeze(['prior_stage', 'primary_contact']),
    exitCriteria: Object.freeze(['need_documented']),
  },
  [CRM_PIPELINE_STAGE.NEED_CONFIRMED]: {
    name: 'Need Confirmed',
    defaultProbability: 30,
    entryCriteria: Object.freeze(['prior_stage', 'primary_contact']),
    exitCriteria: Object.freeze(['solution_fit_assessed']),
  },
  [CRM_PIPELINE_STAGE.SOLUTION_FIT]: {
    name: 'Solution Fit',
    defaultProbability: 40,
    entryCriteria: Object.freeze(['prior_stage', 'primary_contact']),
    exitCriteria: Object.freeze(['commercial_scope_started']),
  },
  [CRM_PIPELINE_STAGE.COMMERCIAL_SCOPING]: {
    name: 'Commercial Scoping',
    defaultProbability: 50,
    entryCriteria: Object.freeze(['prior_stage', 'primary_contact']),
    exitCriteria: Object.freeze(['decision_process_mapped']),
  },
  [CRM_PIPELINE_STAGE.DECISION_PROCESS]: {
    name: 'Decision Process',
    defaultProbability: 60,
    entryCriteria: Object.freeze(['prior_stage', 'primary_contact']),
    exitCriteria: Object.freeze(['proposal_ready']),
  },
  [CRM_PIPELINE_STAGE.PROPOSAL_READY]: {
    name: 'Proposal Ready',
    defaultProbability: 70,
    entryCriteria: Object.freeze(['prior_stage', 'primary_contact']),
    exitCriteria: Object.freeze(['customer_decision_pending']),
  },
  [CRM_PIPELINE_STAGE.CUSTOMER_DECISION]: {
    name: 'Customer Decision',
    defaultProbability: 80,
    entryCriteria: Object.freeze(['prior_stage', 'primary_contact']),
    exitCriteria: Object.freeze(['closed_outcome']),
  },
  [CRM_PIPELINE_STAGE.CLOSED_WON]: {
    name: 'Closed Won',
    defaultProbability: 100,
    entryCriteria: Object.freeze(['terminal_close']),
    exitCriteria: Object.freeze([]),
  },
  [CRM_PIPELINE_STAGE.CLOSED_LOST]: {
    name: 'Closed Lost',
    defaultProbability: 0,
    entryCriteria: Object.freeze(['terminal_close']),
    exitCriteria: Object.freeze([]),
  },
});

/**
 * EXPANSION — entry requires existing Account (expansion of known relationship).
 * Shares stage codes with NEW_BUSINESS; first-stage entryCriteria differs.
 */
const EXPANSION_STAGE_META = Object.freeze({
  ...STAGE_META,
  [CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED]: {
    name: 'Opportunity Identified',
    defaultProbability: 15,
    entryCriteria: Object.freeze(['existing_account', 'expansion_signal']),
    exitCriteria: Object.freeze(['discovery_started']),
  },
});

/**
 * MRA_EIS — MRA / EIS commercial path; entry requires MRA context evidence.
 * Shares stage codes; first-stage entryCriteria differs.
 */
const MRA_EIS_STAGE_META = Object.freeze({
  ...STAGE_META,
  [CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED]: {
    name: 'Opportunity Identified',
    defaultProbability: 12,
    entryCriteria: Object.freeze(['mra_eis_context', 'primary_contact']),
    exitCriteria: Object.freeze(['discovery_started']),
  },
  [CRM_PIPELINE_STAGE.COMMERCIAL_SCOPING]: {
    name: 'Commercial Scoping',
    defaultProbability: 55,
    entryCriteria: Object.freeze(['prior_stage', 'primary_contact', 'mra_scope_acknowledged']),
    exitCriteria: Object.freeze(['decision_process_mapped']),
  },
});

function buildStages(meta) {
  return CRM_PIPELINE_STAGES_ORDERED.map((code, index) => {
    const stageMeta = meta[code];
    const terminal = CRM_PIPELINE_TERMINAL_STAGES.includes(code);
    return Object.freeze({
      code,
      name: stageMeta.name,
      sortOrder: index + 1,
      terminal,
      defaultProbability: stageMeta.defaultProbability,
      entryCriteria: stageMeta.entryCriteria,
      exitCriteria: stageMeta.exitCriteria,
    });
  });
}

/**
 * Default ACTIVE NEW_BUSINESS Pipeline definition (Wave 1).
 */
export function getDefaultNewBusinessPipelineDefinition() {
  return Object.freeze({
    id: 'pipeline-new-business-catalogue',
    code: CRM_PIPELINE_CODE.NEW_BUSINESS,
    name: 'New Business',
    status: CRM_PIPELINE_STATUS.ACTIVE,
    version: CRM_PIPELINE_DEFINITION_VERSION,
    versionId: CRM_PIPELINE_DEFINITION_VERSION,
    stages: Object.freeze(buildStages(STAGE_META)),
    source: 'catalogue',
    weightedUiEnabled: false,
  });
}

/**
 * ACTIVE EXPANSION Pipeline (Wave 4).
 */
export function getDefaultExpansionPipelineDefinition() {
  return Object.freeze({
    id: 'pipeline-expansion-catalogue',
    code: CRM_PIPELINE_CODE.EXPANSION,
    name: 'Expansion',
    status: CRM_PIPELINE_STATUS.ACTIVE,
    version: CRM_PIPELINE_EXPANSION_VERSION,
    versionId: CRM_PIPELINE_EXPANSION_VERSION,
    stages: Object.freeze(buildStages(EXPANSION_STAGE_META)),
    source: 'catalogue',
    weightedUiEnabled: false,
    entryNotes:
      'Requires existing Account + expansion signal; shared stage codes with NEW_BUSINESS.',
  });
}

/**
 * ACTIVE MRA_EIS Pipeline (Wave 4).
 */
export function getDefaultMraEisPipelineDefinition() {
  return Object.freeze({
    id: 'pipeline-mra-eis-catalogue',
    code: CRM_PIPELINE_CODE.MRA_EIS,
    name: 'MRA / EIS',
    status: CRM_PIPELINE_STATUS.ACTIVE,
    version: CRM_PIPELINE_MRA_EIS_VERSION,
    versionId: CRM_PIPELINE_MRA_EIS_VERSION,
    stages: Object.freeze(buildStages(MRA_EIS_STAGE_META)),
    source: 'catalogue',
    weightedUiEnabled: false,
    entryNotes:
      'Requires MRA/EIS context evidence; shared stage codes; commercial scoping adds mra_scope_acknowledged.',
  });
}

/**
 * All ACTIVE catalogue Pipeline definitions (Wave 4).
 */
export function listCataloguePipelineDefinitions() {
  return Object.freeze([
    getDefaultNewBusinessPipelineDefinition(),
    getDefaultExpansionPipelineDefinition(),
    getDefaultMraEisPipelineDefinition(),
  ]);
}

/**
 * @param {string} code
 */
export function getPipelineDefinitionByCode(code) {
  const c = String(code || '').trim().toUpperCase();
  if (c === CRM_PIPELINE_CODE.NEW_BUSINESS) {
    return getDefaultNewBusinessPipelineDefinition();
  }
  if (c === CRM_PIPELINE_CODE.EXPANSION) {
    return getDefaultExpansionPipelineDefinition();
  }
  if (c === CRM_PIPELINE_CODE.MRA_EIS) {
    return getDefaultMraEisPipelineDefinition();
  }
  return null;
}

/**
 * @param {string} stageCode
 */
export function isTerminalStage(stageCode) {
  return CRM_PIPELINE_TERMINAL_STAGES.includes(String(stageCode || '').toUpperCase());
}

/**
 * @param {string} stageCode
 */
export function stageSortOrder(stageCode) {
  const code = String(stageCode || '').trim().toUpperCase();
  const idx = CRM_PIPELINE_STAGES_ORDERED.indexOf(code);
  return idx >= 0 ? idx + 1 : -1;
}

/**
 * Wave 1: sequential forward only + jump to terminal CLOSED_*.
 * Shared across NEW_BUSINESS / EXPANSION / MRA_EIS (same stage codes).
 * @param {string} fromStageCode
 * @param {string} toStageCode
 */
export function canTransitionStage(fromStageCode, toStageCode) {
  const from = String(fromStageCode || '').trim().toUpperCase();
  const to = String(toStageCode || '').trim().toUpperCase();
  if (!from || !to || from === to) return false;
  if (isTerminalStage(from)) return false;
  if (!CRM_PIPELINE_STAGES_ORDERED.includes(from)) return false;
  if (!CRM_PIPELINE_STAGES_ORDERED.includes(to)) return false;

  if (isTerminalStage(to)) return true;

  const openStages = CRM_PIPELINE_STAGES_ORDERED.filter((c) => !isTerminalStage(c));
  const fromOpen = openStages.indexOf(from);
  const toOpen = openStages.indexOf(to);
  if (fromOpen < 0 || toOpen < 0) return false;
  return toOpen === fromOpen + 1;
}

export { STAGE_META, EXPANSION_STAGE_META, MRA_EIS_STAGE_META };
