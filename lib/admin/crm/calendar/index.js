/**

 * CRM Calendar — Phase 13 Wave 3 public surface.

 * Internal events only; Google/Outlook NOT_CONNECTED; ICS export.

 */



export {

  CRM_CALENDAR_CONFLICT_POLICY,

  CRM_CALENDAR_CONFLICT_POLICIES,

  CRM_CALENDAR_VIEW,

  CRM_CALENDAR_VIEWS,

  CRM_CALENDAR_VISIBILITY,

  CRM_CALENDAR_EVENT_STATUS,

  CRM_CALENDAR_INTEGRATION_STATUS,

  CRM_CALENDAR_DEFAULT_WORKING_HOURS,

  CRM_CALENDAR_MAX_RANGE_DAYS,

  getCalendarIntegrationStatus,

  isValidConflictPolicy,

  isValidCalendarView,

} from './catalogue.js';



export { hasCrmCalendarEventModel, serializeCalendarEvent } from './model.js';

export { resolveCalendarRange, rangesOverlap } from './range.js';

export {

  detectCalendarConflicts,

  applyConflictPolicy,

  listCalendarEvents,

  exportIcs,

  createCalendarEventForMeeting,

} from './service.js';

