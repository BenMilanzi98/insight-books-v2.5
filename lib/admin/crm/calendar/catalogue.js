/**
 * Calendar catalogue — Phase 13 Wave 3.
 * Internal CrmCalendarEvent only; Google/Outlook NOT_CONNECTED.
 */

import {
  CRM_CALENDAR_CONFLICT_POLICY,
  CRM_CALENDAR_CONFLICT_POLICIES,
  CRM_CALENDAR_VIEW,
  CRM_CALENDAR_VIEWS,
  CRM_CALENDAR_VISIBILITY,
  CRM_CALENDAR_EVENT_STATUS,
  CRM_CALENDAR_INTEGRATION_STATUS,
} from '../catalogue.js';

export {
  CRM_CALENDAR_CONFLICT_POLICY,
  CRM_CALENDAR_CONFLICT_POLICIES,
  CRM_CALENDAR_VIEW,
  CRM_CALENDAR_VIEWS,
  CRM_CALENDAR_VISIBILITY,
  CRM_CALENDAR_EVENT_STATUS,
  CRM_CALENDAR_INTEGRATION_STATUS,
};

/** Default working hours (local wall clock in event timezone). */
export const CRM_CALENDAR_DEFAULT_WORKING_HOURS = Object.freeze({
  startHour: 8,
  endHour: 17,
  days: Object.freeze([1, 2, 3, 4, 5]), // Mon–Fri
});

/** Max agenda/list span to keep queries bounded. */
export const CRM_CALENDAR_MAX_RANGE_DAYS = 62;

/**
 * Typed Google/Outlook contract — never fabricate external sync.
 */
export function getCalendarIntegrationStatus() {
  return Object.freeze({
    google: CRM_CALENDAR_INTEGRATION_STATUS,
    outlook: CRM_CALENDAR_INTEGRATION_STATUS,
    icsExport: true,
    internalCalendar: true,
    externalEventsFabricated: false,
    inventExternalSyncForbidden: true,
  });
}

/**
 * @param {string} policy
 * @returns {boolean}
 */
export function isValidConflictPolicy(policy) {
  return CRM_CALENDAR_CONFLICT_POLICIES.includes(
    String(policy || '').trim().toUpperCase()
  );
}

/**
 * @param {string} view
 * @returns {boolean}
 */
export function isValidCalendarView(view) {
  return CRM_CALENDAR_VIEWS.includes(String(view || '').trim().toLowerCase());
}
