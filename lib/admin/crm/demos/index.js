/**

 * CRM Demos — Phase 14 Wave 1–4 public surface.

 * Demo ≠ Meeting ≠ Trial ≠ Proposal; RSVP ≠ attendance; convert idempotent.

 * Wave 2: Agenda/Script/Scenario/Content versioning + SoD + restricted projections.

 * Wave 3: Logical DENV + data packs + checklist/rehearsal readiness gates.

 * Wave 4: Delivery/attendance/recording gov/feedback/outcome/handoffs/reports.

 */



export {

  CRM_DEMO_REQUEST_STATUS,

  CRM_DEMO_REQUEST_STATUSES,

  CRM_DEMO_STATUS,

  CRM_DEMO_STATUSES,

  CRM_DEMO_STATUSES_WAVE1,

  CRM_DEMO_TRANSITION_TABLE,

  CRM_DEMO_NUMBER_RE,

  CRM_DEMO_REQUEST_NUMBER_RE,

  CRM_DEMO_ENVIRONMENT_NUMBER_RE,

  CRM_DEMO_PARTICIPANT_TYPE,

  CRM_DEMO_PARTICIPANT_TYPES,

  CRM_DEMO_PARTICIPANT_ROLE,

  CRM_DEMO_PARTICIPANT_ROLES,

  CRM_DEMO_VERSION_STATUS,

  CRM_DEMO_VERSION_STATUSES,

  CRM_DEMO_CONTENT_CLASSIFICATION,

  CRM_DEMO_CONTENT_CLASSIFICATIONS,

  CRM_DEMO_CONTENT_KIND,

  CRM_DEMO_CONTENT_KINDS,

  CRM_DEMO_PROJECTION_SURFACE,

  CRM_DEMO_PROJECTION_SURFACES,

  CRM_DEMO_ENVIRONMENT_STATUS,

  CRM_DEMO_ENVIRONMENT_STATUSES,

  CRM_DEMO_ENVIRONMENT_HEALTH,

  CRM_DEMO_ENVIRONMENT_HEALTHS,

  CRM_DEMO_DATA_PACK_SOURCE_KIND,

  CRM_DEMO_DATA_PACK_SOURCE_KINDS,

  CRM_DEMO_CHECKLIST_EXECUTION_STATUS,

  CRM_DEMO_CHECKLIST_EXECUTION_STATUSES,

  CRM_DEMO_REHEARSAL_OUTCOME,

  CRM_DEMO_REHEARSAL_OUTCOMES,

  CRM_DEMO_ISSUE_SEVERITY,

  CRM_DEMO_ISSUE_SEVERITIES,

  CRM_DEMO_ATTENDANCE_STATUS,

  CRM_DEMO_ATTENDANCE_STATUSES,

  CRM_DEMO_ATTENDANCE_SOURCE,

  CRM_DEMO_ATTENDANCE_SOURCES,

  CRM_DEMO_RECORDING_GOV_STATUS,

  CRM_DEMO_RECORDING_GOV_STATUSES,

  CRM_DEMO_OUTCOME_CODE,

  CRM_DEMO_OUTCOME_CODES,

  CRM_DEMO_OUTCOME_COMPLETENESS,

  CRM_DEMO_OUTCOME_COMPLETENESS_VALUES,

  CRM_DEMO_ISSUE_STATUS,

  CRM_DEMO_ISSUE_STATUSES,

  CRM_DEMO_QUESTION_STATUS,

  CRM_DEMO_QUESTION_STATUSES,

  CRM_DEMO_HANDOFF_TYPE,

  CRM_DEMO_HANDOFF_TYPES,

  CRM_DEMO_REPORT_STATUS,

  CRM_DEMO_REPORT_SCHEDULE_STATUS,

  CRM_READINESS_STATUS,

  isValidDemoStatus,

  isValidDemoRequestStatus,

  isValidDemoParticipantRole,

  isValidDemoParticipantType,

  isValidDemoEnvironmentStatus,

  isValidDemoAttendanceStatus,

  isValidDemoAttendanceSource,

  isValidDemoOutcomeCode,

  isValidDemoOutcomeCompleteness,

  canTransitionDemoStatus,

  getDemoDomainContract,

} from './catalogue.js';



export {

  allocateDemoRequestNumber,

  allocateDemoNumber,

  allocateDemoEnvironmentNumber,

} from './numbering.js';



export {

  hasCrmDemoRequestModel,

  hasCrmDemoModel,

  hasCrmDemoParticipantModel,

  hasCrmDemoStatusHistoryModel,

  serializeDemoRequest,

  serializeDemo,

  serializeDemoParticipant,

  serializeDemoStatusHistory,

} from './model.js';



export {

  createDemoRequest,

  qualifyDemoRequest,

  rejectDemoRequest,

  convertDemoRequest,

  listDemoRequests,

} from './requests.js';



export {

  createDemo,

  getDemo,

  listDemos,

  transitionDemoStatus,

} from './service.js';



export {

  addDemoParticipant,

  removeDemoParticipant,

  listDemoParticipants,

} from './participants.js';



export { scheduleDemo } from './schedule.js';



export {

  evaluateDemoReadiness,

  configureDemoReadinessRequirements,

} from './readiness.js';



export {

  listDemosForLead,

  listDemosForOpportunity,

} from './projections.js';



export {

  hasCrmDemoAgendaModel,

  createAgendaVersion,

  updateAgendaVersion,

  requestAgendaApproval,

  approveAgendaVersion,

  listAgendaVersions,

  projectAgendaForSurface,

  pinAgendaToDemo,

  serializeAgenda,

} from './agendas.js';



export {

  hasCrmDemoScriptModel,

  createScriptVersion,

  updateScriptVersion,

  requestScriptApproval,

  approveScriptVersion,

  listScriptVersions,

  projectScriptForSurface,

  pinScriptToDemo,

  serializeScript,

} from './scripts.js';



export {

  hasCrmDemoScenarioModel,

  createScenarioVersion,

  updateScenarioVersion,

  requestScenarioApproval,

  approveScenarioVersion,

  listScenarioVersions,

  pinScenarioToDemo,

  serializeScenario,

} from './scenarios.js';



export {

  hasCrmDemoContentModel,

  createContentVersion,

  updateContentVersion,

  requestContentApproval,

  approveContentVersion,

  listContentVersions,

  pinContentToDemo,

  serializeContent,

} from './content.js';



export {

  hasCrmDemoDataPackModel,

  validateDataPackSource,

  createDataPackVersion,

  updateDataPackVersion,

  requestDataPackApproval,

  approveDataPackVersion,

  listDataPackVersions,

  serializeDataPack,

} from './dataPacks.js';



export {

  hasCrmDemoEnvironmentModel,

  evaluateLogicalEnvironmentHealth,

  requestDemoEnvironment,

  approveDemoEnvironment,

  provisionDemoEnvironment,

  runDemoEnvironmentHealthCheck,

  resetDemoEnvironment,

  deprovisionDemoEnvironment,

  getDemoEnvironment,

  listDemoEnvironments,

  serializeEnvironment,

} from './environments.js';



export {

  hasCrmDemoChecklistModel,

  hasCrmDemoChecklistExecutionModel,

  createChecklistVersion,

  updateChecklistVersion,

  requestChecklistApproval,

  approveChecklistVersion,

  listChecklistVersions,

  pinChecklistToDemo,

  executeDemoChecklist,

  serializeChecklist,

  serializeChecklistExecution,

} from './checklists.js';



export {

  hasCrmDemoRehearsalModel,

  recordDemoRehearsal,

  listDemoRehearsals,

  serializeRehearsal,

} from './rehearsals.js';



export {

  hasCrmDemoDeliverySessionModel,

  hasCrmDemoLiveIssueModel,

  hasCrmDemoCustomerQuestionModel,

  startDemoDelivery,

  endDemoDelivery,

  recordAgendaCoverage,

  recordLiveIssue,

  recordCustomerQuestion,

  getDemoDeliverySession,

  serializeDeliverySession,

  serializeLiveIssue,

  serializeCustomerQuestion,

} from './delivery.js';



export {

  hasCrmDemoAttendanceModel,

  recordDemoAttendance,

  projectAttendanceFromMeeting,

  listDemoAttendance,

  serializeDemoAttendance,

} from './attendance.js';



export {

  hasCrmDemoRecordingGovModel,

  requestDemoRecording,

  setDemoRecordingConsent,

  approveDemoRecording,

  denyDemoRecording,

  getDemoRecordingGov,

  serializeRecordingGov,

  CRM_DEMO_RECORDING_PROVIDER_STATUS,

} from './recording.js';



export {

  hasCrmDemoFeedbackFormModel,

  hasCrmDemoFeedbackResponseModel,

  createFeedbackFormVersion,

  recordDemoFeedbackResponse,

  listDemoFeedbackResponses,

  serializeFeedbackForm,

  serializeFeedbackResponse,

} from './feedback.js';



export {

  hasCrmDemoOutcomeModel,

  recordDemoOutcome,

  getDemoOutcome,

  serializeDemoOutcome,

} from './outcomes.js';



export { createDemoFollowUp } from './followUps.js';



export {

  hasCrmDemoHandoffModel,

  emitDemoProposalHandoff,

  emitDemoTrialHandoff,

  assertNoProposalOrTrialCreate,

  listDemoHandoffs,

  serializeDemoHandoff,

  DEMO_PROPOSAL_HANDOFF_TYPE,

  DEMO_PROPOSAL_HANDOFF_VERSION,

  DEMO_TRIAL_HANDOFF_TYPE,

  DEMO_TRIAL_HANDOFF_VERSION,

} from './handoffs.js';



export {

  getDemoReport,

  applyDemoReportHonesty,

  CRM_DEMO_REPORT_VERSION,

} from './reports.js';



export {

  hasCrmDemoReportScheduleModel,

  hasCrmDemoReportRunModel,

  createDemoReportSchedule,

  listDemoReportSchedules,

  runDemoReportSchedule,

} from './reportSchedules.js';


