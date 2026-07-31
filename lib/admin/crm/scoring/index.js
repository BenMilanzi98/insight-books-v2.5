/**
 * CRM scoring — Phase 11 Wave 3 public surface.
 */

export {
  CRM_SCORE_CONFIDENCE,
  CRM_SCORE_CONFIDENCES,
  CRM_SCORE_BAND,
  CRM_SCORE_BANDS,
  CRM_DEFAULT_SCORE_VERSION_ID,
  CRM_SCORE_FORBIDDEN_LABELS,
  getDefaultScoreDefinition,
} from './catalogue.js';

export {
  getScoreDefinitionByVersion,
  getActiveScoreDefinition,
  listScoreDefinitions,
} from './definitions.js';

export {
  hasCrmScoreEvaluationModel,
  hasCrmScoreContributionModel,
  assertScoreLabelSafe,
  computeScore,
  runLeadScore,
  getLatestLeadScore,
} from './engine.js';
