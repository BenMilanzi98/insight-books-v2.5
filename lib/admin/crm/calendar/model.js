/**
 * CrmCalendarEvent model guards + serialize — Phase 13 Wave 3.
 */

import { CRM_CALENDAR_EVENT_STATUS, CRM_CALENDAR_VISIBILITY } from '../catalogue.js';

export function hasCrmCalendarEventModel(prisma) {
  return typeof prisma?.crmCalendarEvent?.create === 'function';
}

export function serializeCalendarEvent(row, opts = {}) {
  if (!row) return null;
  const availabilityOnly = opts.availabilityOnly === true;
  const isPrivate =
    String(row.visibility || CRM_CALENDAR_VISIBILITY.PUBLIC).toUpperCase() ===
    CRM_CALENDAR_VISIBILITY.PRIVATE;

  if (availabilityOnly && isPrivate) {
    return {
      id: row.id,
      activityId: row.activityId || null,
      meetingId: row.meetingId || null,
      title: 'Busy',
      startsAtUtc: row.startsAtUtc ? new Date(row.startsAtUtc).toISOString() : null,
      endsAtUtc: row.endsAtUtc ? new Date(row.endsAtUtc).toISOString() : null,
      timezone: row.timezone || null,
      ownerAdminId: row.ownerAdminId || null,
      visibility: CRM_CALENDAR_VISIBILITY.PRIVATE,
      status: row.status || CRM_CALENDAR_EVENT_STATUS.SCHEDULED,
      busy: true,
      privateDetailsHidden: true,
      location: null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    };
  }

  return {
    id: row.id,
    activityId: row.activityId || null,
    meetingId: row.meetingId || null,
    title: row.title || null,
    startsAtUtc: row.startsAtUtc ? new Date(row.startsAtUtc).toISOString() : null,
    endsAtUtc: row.endsAtUtc ? new Date(row.endsAtUtc).toISOString() : null,
    timezone: row.timezone || null,
    ownerAdminId: row.ownerAdminId || null,
    visibility: row.visibility || CRM_CALENDAR_VISIBILITY.PUBLIC,
    status: row.status || CRM_CALENDAR_EVENT_STATUS.SCHEDULED,
    busy: true,
    privateDetailsHidden: false,
    location: row.location || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}
