/**
 * CRM automation foundations — Phase 13 Wave 4.
 */

export {
  CRM_AUTOMATION_TRIGGER,
  CRM_AUTOMATION_TRIGGERS,
  CRM_AUTOMATION_RULE_STATUS,
  CRM_AUTOMATION_RULE_STATUSES,
  CRM_AUTOMATION_EXECUTION_STATUS,
  CRM_AUTOMATION_EXECUTION_STATUSES,
  CRM_AUTOMATION_ACTION,
  CRM_AUTOMATION_ACTIONS,
  CRM_AUTOMATION_DEFINITION_VERSION,
  APPROVED_TRIGGER_ACTIONS,
} from './catalogue.js';
// Note: main crm/index.js re-exports trigger/status constants from catalogue.js
// to avoid duplicate named exports; ACTION / DEFINITION_VERSION come from here.

export {
  hasCrmAutomationRuleModel,
  hasCrmAutomationApprovalModel,
  createAutomationRule,
  requestAutomationApproval,
  approveAutomationRule,
  listAutomationRules,
  serializeRule,
  isApprovedPair,
} from './rules.js';

export {
  hasCrmAutomationExecutionModel,
  executeAutomationRule,
  buildIdempotencyKey,
  serializeExecution,
} from './execute.js';
