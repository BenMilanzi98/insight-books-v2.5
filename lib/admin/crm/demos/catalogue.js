/**
 * Demo catalogue — Phase 14 Wave 1–4.
 * Demo ≠ Meeting ≠ Trial ≠ Proposal; RSVP ≠ attendance; MRA EIS sandbox ≠ Demo Environment.
 * Wave 2: versioned Agenda/Script/Scenario/Content; ACTIVE immutable; SoD approve.
 * Wave 3: Logical DENV + data packs + checklist/rehearsal readiness gates.
 * Wave 4: Delivery/attendance/recording gov/feedback/outcome/handoffs/reports.
 */

import {
  CRM_DEMO_ATTENDANCE_SOURCE,
  CRM_DEMO_ATTENDANCE_SOURCES,
  CRM_DEMO_ATTENDANCE_STATUS,
  CRM_DEMO_ATTENDANCE_STATUSES,
  CRM_DEMO_CHECKLIST_EXECUTION_STATUS,
  CRM_DEMO_CHECKLIST_EXECUTION_STATUSES,
  CRM_DEMO_CONTENT_CLASSIFICATION,
  CRM_DEMO_CONTENT_CLASSIFICATIONS,
  CRM_DEMO_CONTENT_KIND,
  CRM_DEMO_CONTENT_KINDS,
  CRM_DEMO_DATA_PACK_SOURCE_KIND,
  CRM_DEMO_DATA_PACK_SOURCE_KINDS,
  CRM_DEMO_ENVIRONMENT_HEALTH,
  CRM_DEMO_ENVIRONMENT_HEALTHS,
  CRM_DEMO_ENVIRONMENT_NUMBER_RE,
  CRM_DEMO_ENVIRONMENT_STATUS,
  CRM_DEMO_ENVIRONMENT_STATUSES,
  CRM_DEMO_HANDOFF_TYPE,
  CRM_DEMO_HANDOFF_TYPES,
  CRM_DEMO_ISSUE_SEVERITY,
  CRM_DEMO_ISSUE_SEVERITIES,
  CRM_DEMO_ISSUE_STATUS,
  CRM_DEMO_ISSUE_STATUSES,
  CRM_DEMO_NUMBER_RE,
  CRM_DEMO_OUTCOME_CODE,
  CRM_DEMO_OUTCOME_CODES,
  CRM_DEMO_OUTCOME_COMPLETENESS,
  CRM_DEMO_OUTCOME_COMPLETENESS_VALUES,
  CRM_DEMO_PROJECTION_SURFACE,
  CRM_DEMO_PROJECTION_SURFACES,
  CRM_DEMO_QUESTION_STATUS,
  CRM_DEMO_QUESTION_STATUSES,
  CRM_DEMO_RECORDING_GOV_STATUS,
  CRM_DEMO_RECORDING_GOV_STATUSES,
  CRM_DEMO_REHEARSAL_OUTCOME,
  CRM_DEMO_REHEARSAL_OUTCOMES,
  CRM_DEMO_REPORT_SCHEDULE_STATUS,
  CRM_DEMO_REPORT_STATUS,
  CRM_DEMO_REQUEST_NUMBER_RE,
  CRM_DEMO_REQUEST_STATUS,
  CRM_DEMO_REQUEST_STATUSES,
  CRM_DEMO_STATUS,
  CRM_DEMO_STATUSES,
  CRM_DEMO_STATUSES_WAVE1,
  CRM_DEMO_TRANSITION_TABLE,
  CRM_DEMO_VERSION_STATUS,
  CRM_DEMO_VERSION_STATUSES,
  CRM_NUMBER_PREFIX,
  CRM_READINESS_STATUS,
  CRM_READINESS_STATUSES,
} from '../catalogue.js';

export {
  CRM_DEMO_NUMBER_RE,
  CRM_DEMO_REQUEST_NUMBER_RE,
  CRM_DEMO_ENVIRONMENT_NUMBER_RE,
  CRM_DEMO_REQUEST_STATUS,
  CRM_DEMO_REQUEST_STATUSES,
  CRM_DEMO_STATUS,
  CRM_DEMO_STATUSES,
  CRM_DEMO_STATUSES_WAVE1,
  CRM_DEMO_TRANSITION_TABLE,
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
  CRM_NUMBER_PREFIX,
  CRM_READINESS_STATUS,
  CRM_READINESS_STATUSES,
};

export const CRM_DEMO_PARTICIPANT_TYPE = Object.freeze({
  CONTACT: 'CONTACT',
  ADMIN: 'ADMIN',
  EXTERNAL: 'EXTERNAL',
});

export const CRM_DEMO_PARTICIPANT_TYPES = Object.freeze(
  Object.values(CRM_DEMO_PARTICIPANT_TYPE)
);

export const CRM_DEMO_PARTICIPANT_ROLE = Object.freeze({
  PRIMARY_CONTACT: 'PRIMARY_CONTACT',
  PRESENTER: 'PRESENTER',
  ORGANIZER: 'ORGANIZER',
  REQUIRED: 'REQUIRED',
  OPTIONAL: 'OPTIONAL',
});

export const CRM_DEMO_PARTICIPANT_ROLES = Object.freeze(
  Object.values(CRM_DEMO_PARTICIPANT_ROLE)
);

const DEMO_STATUS_SET = new Set(CRM_DEMO_STATUSES);
const REQUEST_STATUS_SET = new Set(CRM_DEMO_REQUEST_STATUSES);
const ROLE_SET = new Set(CRM_DEMO_PARTICIPANT_ROLES);
const TYPE_SET = new Set(CRM_DEMO_PARTICIPANT_TYPES);
const ENV_STATUS_SET = new Set(CRM_DEMO_ENVIRONMENT_STATUSES);
const ATTENDANCE_STATUS_SET = new Set(CRM_DEMO_ATTENDANCE_STATUSES);
const ATTENDANCE_SOURCE_SET = new Set(CRM_DEMO_ATTENDANCE_SOURCES);
const OUTCOME_CODE_SET = new Set(CRM_DEMO_OUTCOME_CODES);
const COMPLETENESS_SET = new Set(CRM_DEMO_OUTCOME_COMPLETENESS_VALUES);

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isValidDemoStatus(status) {
  return DEMO_STATUS_SET.has(String(status || '').trim().toUpperCase());
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isValidDemoRequestStatus(status) {
  return REQUEST_STATUS_SET.has(String(status || '').trim().toUpperCase());
}

/**
 * @param {string} role
 * @returns {boolean}
 */
export function isValidDemoParticipantRole(role) {
  return ROLE_SET.has(String(role || '').trim().toUpperCase());
}

/**
 * @param {string} type
 * @returns {boolean}
 */
export function isValidDemoParticipantType(type) {
  return TYPE_SET.has(String(type || '').trim().toUpperCase());
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isValidDemoEnvironmentStatus(status) {
  return ENV_STATUS_SET.has(String(status || '').trim().toUpperCase());
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isValidDemoAttendanceStatus(status) {
  return ATTENDANCE_STATUS_SET.has(String(status || '').trim().toUpperCase());
}

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isValidDemoAttendanceSource(source) {
  return ATTENDANCE_SOURCE_SET.has(String(source || '').trim().toUpperCase());
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isValidDemoOutcomeCode(code) {
  return OUTCOME_CODE_SET.has(String(code || '').trim().toUpperCase());
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isValidDemoOutcomeCompleteness(value) {
  return COMPLETENESS_SET.has(String(value || '').trim().toUpperCase());
}

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function canTransitionDemoStatus(from, to) {
  const f = String(from || '').trim().toUpperCase();
  const t = String(to || '').trim().toUpperCase();
  if (!DEMO_STATUS_SET.has(t)) return false;
  const allowed = CRM_DEMO_TRANSITION_TABLE[f];
  return Array.isArray(allowed) && allowed.includes(t);
}

/**
 * Honesty contract — never alias Meeting / MRA EIS / Proposal / Tenant / cloud infra.
 */
export function getDemoDomainContract() {
  return Object.freeze({
    demoEqualsMeeting: false,
    meetingCompletedEqualsDemoDelivered: false,
    rsvpEqualsAttendance: false,
    inventAttendanceForbidden: true,
    inventAttendanceFromRsvpForbidden: true,
    mraEisSandboxEqualsDemoEnvironment: false,
    inventProposalForbidden: true,
    inventTrialForbidden: true,
    inventTenantProvisionForbidden: true,
    autoOpportunityStageMutationForbidden: true,
    autoOpportunityProbabilityMutationForbidden: true,
    recordingProvider: 'NOT_AVAILABLE',
    inventRecordingFileForbidden: true,
    cloudDemoInfra: 'NOT_AVAILABLE',
    activeDirectlyEditable: false,
    restrictedScriptOnCustomerForbidden: true,
    sodApproveRequired: true,
    inventAiScriptForbidden: true,
    inventEnvironmentReadyForbidden: true,
    productionDataPackForbidden: true,
    productionConnectionsForbidden: true,
    demoBannerRequired: true,
    expiryRequired: true,
    completenessEqualsSuccessForbidden: true,
    inventReportZeroesForbidden: true,
    handoffPayloadOnly: true,
    wave: 4,
  });
}
