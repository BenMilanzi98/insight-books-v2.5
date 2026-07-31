/**
 * Meeting catalogue — Phase 13 Wave 3.
 * RSVP ≠ attendance; Meeting ≠ Demo.
 */

import {
  CRM_MEETING_STATUS,
  CRM_MEETING_STATUSES,
  CRM_MEETING_RSVP,
  CRM_MEETING_RSVPS,
  CRM_MEETING_ATTENDANCE,
  CRM_MEETING_ATTENDANCES,
  CRM_MEETING_INVITATION_STATUS,
  CRM_MEETING_INVITATION_STATUSES,
  CRM_MEETING_OUTCOME,
  CRM_MEETING_OUTCOMES,
  CRM_MEETING_NUMBER_RE,
  CRM_CALENDAR_INTEGRATION_STATUS,
} from '../catalogue.js';

export {
  CRM_MEETING_STATUS,
  CRM_MEETING_STATUSES,
  CRM_MEETING_RSVP,
  CRM_MEETING_RSVPS,
  CRM_MEETING_ATTENDANCE,
  CRM_MEETING_ATTENDANCES,
  CRM_MEETING_INVITATION_STATUS,
  CRM_MEETING_INVITATION_STATUSES,
  CRM_MEETING_OUTCOME,
  CRM_MEETING_OUTCOMES,
  CRM_MEETING_NUMBER_RE,
  CRM_CALENDAR_INTEGRATION_STATUS,
};

const RSVP_SET = new Set(CRM_MEETING_RSVPS);
const ATTENDANCE_SET = new Set(CRM_MEETING_ATTENDANCES);
const OUTCOME_SET = new Set(CRM_MEETING_OUTCOMES);

export const CRM_MEETING_PARTICIPANT_TYPE = Object.freeze({
  CONTACT: 'CONTACT',
  ADMIN: 'ADMIN',
  EXTERNAL: 'EXTERNAL',
});

export const CRM_MEETING_PARTICIPANT_ROLE = Object.freeze({
  ORGANIZER: 'ORGANIZER',
  REQUIRED: 'REQUIRED',
  OPTIONAL: 'OPTIONAL',
});

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isValidMeetingRsvp(status) {
  return RSVP_SET.has(String(status || '').trim().toUpperCase());
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isValidMeetingAttendance(status) {
  return ATTENDANCE_SET.has(String(status || '').trim().toUpperCase());
}

/**
 * @param {string} outcome
 * @returns {boolean}
 */
export function isValidMeetingOutcome(outcome) {
  return OUTCOME_SET.has(String(outcome || '').trim().toUpperCase());
}

/**
 * Typed external calendar boundary — never fabricate Google/Outlook Events.
 */
export function getMeetingIntegrationContract() {
  return Object.freeze({
    google: CRM_CALENDAR_INTEGRATION_STATUS,
    outlook: CRM_CALENDAR_INTEGRATION_STATUS,
    externalEventsFabricated: false,
    inventAttendanceFromRsvpForbidden: true,
  });
}
