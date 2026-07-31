/**
 * CRM Activities — Phase 13 Wave 1 public surface.
 */

export {
  CRM_ACTIVITY_TYPE,
  CRM_ACTIVITY_TYPES,
  CRM_ACTIVITY_TYPES_WAVE1,
  CRM_ACTIVITY_TYPES_WAVE2,
  CRM_ACTIVITY_TYPES_WAVE3,
  CRM_ACTIVITY_TYPES_CREATABLE,
  CRM_ACTIVITY_STATUS,
  CRM_ACTIVITY_STATUSES,
  CRM_ACTIVITY_DIRECTION,
  CRM_ACTIVITY_DIRECTIONS,
  CRM_ACTIVITY_TYPE_STATUS_COMPAT,
  CRM_ACTIVITY_RELATION_ROLE,
  CRM_ACTIVITY_NUMBER_RE,
  CRM_TASK_NUMBER_RE,
  CRM_FOLLOW_UP_STATUS,
  CRM_FOLLOW_UP_STATUSES,
  CRM_NEXT_ACTION_STATUS,
  CRM_NEXT_ACTION_STATUSES,
  CRM_ACTIVITY_STATUS_TRANSITIONS,
  isActivityStatusCompatible,
  canTransitionActivityStatus,
} from './catalogue.js';

export {
  allocateActivityNumber,
  allocateTaskNumber,
  formatCrmNumber,
  utcYearOf,
} from './numbering.js';

export {
  hasCrmActivityModel,
  hasCrmActivityStatusHistoryModel,
  hasCrmActivityRelationModel,
  hasCrmActivityParticipantModel,
  serializeActivity,
} from './model.js';

export { createCrmActivity } from './create.js';
export { getCrmActivity } from './get.js';
export { listCrmActivities } from './list.js';
export { transitionActivityStatus } from './status.js';

export { linkActivityRelation, listActivityRelations } from './relations.js';
export {
  addActivityParticipant,
  listActivityParticipants,
  CRM_ACTIVITY_PARTICIPANT_TYPE,
  CRM_ACTIVITY_PARTICIPANT_ROLE,
} from './participants.js';

export {
  CRM_ACTIVITY_REPORT_VERSION,
  applyActivityReportHonesty,
  getActivityReport,
} from './reports.js';

export {
  hasCrmActivityReportScheduleModel,
  hasCrmActivityReportRunModel,
  createActivityReportSchedule,
  listActivityReportSchedules,
  runActivityReportSchedule,
} from './reportSchedules.js';

export {
  CRM_ACTIVITY_DQ_VERSION,
  evaluateActivityDataQuality,
} from './dataQuality.js';

export {
  CRM_ACTIVITY_RECON_VERSION,
  runActivityReconciliation,
} from './reconciliation.js';

export { listEntityActivityProjections } from './entityPanel.js';
