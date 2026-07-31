/**

 * CRM Meetings — Phase 13 Wave 3 public surface.

 * RSVP ≠ attendance; Meeting ≠ Demo; Activity-linked fail-closed.

 */



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

  CRM_MEETING_PARTICIPANT_TYPE,

  CRM_MEETING_PARTICIPANT_ROLE,

  isValidMeetingRsvp,

  isValidMeetingAttendance,

  isValidMeetingOutcome,

  getMeetingIntegrationContract,

} from './catalogue.js';



export { allocateMeetingNumber } from './numbering.js';

export {

  hasCrmMeetingModel,

  hasCrmMeetingParticipantModel,

  hasCrmMeetingRescheduleHistoryModel,

  serializeMeeting,

  serializeMeetingParticipant,

  serializeRescheduleHistory,

} from './model.js';

export {

  createMeeting,

  rescheduleMeeting,

  cancelMeeting,

  recordMeetingRsvp,

  recordAttendance,

  listMeetings,

} from './service.js';

