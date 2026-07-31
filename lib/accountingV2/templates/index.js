/**
 * Posting engine — template catalogue entry point (Phase 4).
 * Importing this module registers every template exactly once.
 */
import './pilotTemplates.js';
import './definitions.js';
import './stageTemplates.js';
import './remainingStageTemplates.js';

export {
  registerTemplate,
  getActiveTemplate,
  getTemplateDefinition,
  listTemplates,
  TemplateStatus,
} from './templateRegistry.js';
