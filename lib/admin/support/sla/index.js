/**
 * Support SLA public surface — Phase 10 Wave 3.
 */

export {
  SUPPORT_SLA_CLOCK_TYPE,
  SUPPORT_SLA_CLOCK_TYPES,
  SUPPORT_SLA_CLOCK_STATE,
  SUPPORT_SLA_CLOCK_STATES,
  SUPPORT_SLA_EVENT_TYPE,
  SUPPORT_DEFAULT_SLA_POLICY_VERSION_ID,
  SUPPORT_DEFAULT_SLA_CALENDAR_VERSION_ID,
  SUPPORT_SLA_AVAILABILITY,
} from './catalogue.js';

export {
  getDefaultSlaCalendar,
  getSlaCalendarByVersion,
  elapsedBusinessMs,
  addBusinessMs,
  zonedLocalToUtc,
} from './calendars.js';

export {
  getDefaultSlaPolicy,
  getSlaPolicyByVersion,
  shouldPauseForStatus,
  listSlaPolicies,
} from './policies.js';

export {
  hasSupportSlaClockModel,
  startClocksOnTicketCreate,
  stopFirstResponseOnPublicReply,
  onTicketStatusChangeForSla,
  evaluateClockBreach,
  listClocksForTicket,
  serializeClock,
} from './clocks.js';
