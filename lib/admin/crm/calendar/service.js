/**
 * Internal Calendar — Phase 13 Wave 3.
 * Conflict detect server-side; ICS export; Google/Outlook NOT_CONNECTED.
 * Never reuse SupportSlaCalendar.
 */

import {
  CRM_CALENDAR_CONFLICT_POLICY,
  CRM_CALENDAR_EVENT_STATUS,
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
  CRM_MEETING_STATUS,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import {
  CRM_CALENDAR_DEFAULT_WORKING_HOURS,
  getCalendarIntegrationStatus,
  isValidConflictPolicy,
  isValidCalendarView,
} from './catalogue.js';
import { hasCrmCalendarEventModel, serializeCalendarEvent } from './model.js';
import { rangesOverlap, resolveCalendarRange } from './range.js';

function canViewCalendar(access) {
  return (
    access.canView ||
    access.canViewLeads ||
    access.canViewOpportunities ||
    access.canEditActivities
  );
}

function canEditCalendar(access) {
  return (
    access.canEditActivities ||
    access.canEditLeads ||
    access.canEditOpportunities ||
    access.canCreateLeads
  );
}

function toUtcDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function icsEscape(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function toIcsUtc(date) {
  const d = toUtcDate(date);
  if (!d) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * Detect overlapping calendar events / meetings for an owner window.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} args
 */
export async function detectCalendarConflicts(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canViewCalendar(access)) {
    return { ok: false, forbidden: true, reason: 'crm_calendar_view_forbidden' };
  }

  const startsAt = toUtcDate(args.startsAt);
  const endsAt = toUtcDate(args.endsAt);
  if (!startsAt || !endsAt) {
    return { ok: false, error: 'startsAt_and_endsAt_required' };
  }
  if (endsAt <= startsAt) {
    return { ok: false, error: 'end_before_start' };
  }

  const ownerAdminId = args.ownerAdminId
    ? String(args.ownerAdminId).trim()
    : args.admin?.id || null;
  if (!ownerAdminId) {
    return { ok: false, error: 'ownerAdminId_required' };
  }

  const excludeMeetingId = args.excludeMeetingId
    ? String(args.excludeMeetingId).trim()
    : null;

  const conflicts = [];

  if (hasCrmCalendarEventModel(prisma)) {
    try {
      const rows = await prisma.crmCalendarEvent.findMany({
        where: {
          AND: [
            { ownerAdminId },
            { startsAtUtc: { lt: endsAt } },
            { endsAtUtc: { gt: startsAt } },
            { status: { not: CRM_CALENDAR_EVENT_STATUS.CANCELLED } },
            ...(excludeMeetingId ? [{ meetingId: { not: excludeMeetingId } }] : []),
          ],
        },
      });
      for (const row of rows || []) {
        if (
          rangesOverlap(
            startsAt,
            endsAt,
            new Date(row.startsAtUtc),
            new Date(row.endsAtUtc)
          )
        ) {
          conflicts.push({
            type: 'CALENDAR_EVENT',
            id: row.id,
            meetingId: row.meetingId || null,
            activityId: row.activityId || null,
            title: row.title || null,
            startsAtUtc: new Date(row.startsAtUtc).toISOString(),
            endsAtUtc: new Date(row.endsAtUtc).toISOString(),
          });
        }
      }
    } catch {
      // continue with meeting store if present
    }
  }

  if (typeof prisma?.crmMeeting?.findMany === 'function') {
    try {
      const meetings = await prisma.crmMeeting.findMany({
        where: {
          AND: [
            { ownerAdminId },
            { startsAtUtc: { lt: endsAt } },
            { endsAtUtc: { gt: startsAt } },
            { status: { not: CRM_MEETING_STATUS.CANCELLED } },
            ...(excludeMeetingId ? [{ id: { not: excludeMeetingId } }] : []),
          ],
        },
      });
      const seenMeetingIds = new Set(
        conflicts.filter((c) => c.meetingId).map((c) => c.meetingId)
      );
      for (const row of meetings || []) {
        if (seenMeetingIds.has(row.id)) continue;
        if (
          rangesOverlap(
            startsAt,
            endsAt,
            new Date(row.startsAtUtc),
            new Date(row.endsAtUtc)
          )
        ) {
          conflicts.push({
            type: 'MEETING',
            id: row.id,
            meetingId: row.id,
            activityId: row.activityId || null,
            title: row.title || null,
            startsAtUtc: new Date(row.startsAtUtc).toISOString(),
            endsAtUtc: new Date(row.endsAtUtc).toISOString(),
          });
        }
      }
    } catch {
      // best-effort
    }
  }

  return {
    ok: true,
    conflicts,
    hasConflict: conflicts.length > 0,
    integrations: getCalendarIntegrationStatus(),
  };
}

/**
 * Apply conflict policy. Server-side truth only.
 *
 * @returns {{ ok: true, conflicts: any[], policy: string, conflictReason?: string } | { ok: false, error: string, conflicts?: any[] }}
 */
export async function applyConflictPolicy(prisma, args = {}) {
  const policy = String(args.conflictPolicy || CRM_CALENDAR_CONFLICT_POLICY.WARN)
    .trim()
    .toUpperCase();
  if (!isValidConflictPolicy(policy)) {
    return { ok: false, error: 'invalid_conflict_policy', policy };
  }

  const detected = await detectCalendarConflicts(prisma, args);
  if (!detected.ok) return detected;

  const conflicts = detected.conflicts || [];
  if (!conflicts.length) {
    return { ok: true, conflicts: [], policy };
  }

  if (policy === CRM_CALENDAR_CONFLICT_POLICY.BLOCK) {
    return {
      ok: false,
      error: 'calendar_conflict_blocked',
      conflicts,
      policy,
    };
  }

  if (policy === CRM_CALENDAR_CONFLICT_POLICY.ALLOW_WITH_REASON) {
    const reason = args.conflictReason != null ? String(args.conflictReason).trim() : '';
    if (!reason) {
      return {
        ok: false,
        error: 'conflict_reason_required',
        conflicts,
        policy,
      };
    }
    return { ok: true, conflicts, policy, conflictReason: reason };
  }

  // WARN — allow with conflicts listed
  return { ok: true, conflicts, policy };
}

/**
 * List calendar events for day/week/month/agenda (bounded).
 */
export async function listCalendarEvents(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canViewCalendar(access)) {
    return { ok: false, forbidden: true, reason: 'crm_calendar_view_forbidden' };
  }

  if (!hasCrmCalendarEventModel(prisma)) {
    return {
      ok: false,
      error: 'crm_calendar_event_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const view = String(args.view || 'day').trim().toLowerCase();
  if (!isValidCalendarView(view)) {
    return { ok: false, error: 'invalid_calendar_view', view };
  }

  const range = resolveCalendarRange(args.date || args.rangeStart || new Date(), view);
  if (!range.ok) return range;

  const ownerAdminId = args.ownerAdminId
    ? String(args.ownerAdminId).trim()
    : undefined;
  const limit = Math.min(
    Math.max(Number(args.limit) || CRM_LIST_DEFAULT_LIMIT, 1),
    CRM_LIST_MAX_LIMIT
  );
  const availabilityOnly = args.availabilityOnly === true;

  let rows = [];
  try {
    rows = await prisma.crmCalendarEvent.findMany({
      where: {
        ...(ownerAdminId ? { ownerAdminId } : {}),
        status: args.includeCancelled
          ? undefined
          : CRM_CALENDAR_EVENT_STATUS.SCHEDULED,
        AND: [
          { startsAtUtc: { lt: range.rangeEnd } },
          { endsAtUtc: { gt: range.rangeStart } },
        ],
      },
    });
  } catch {
    rows = [];
  }

  // Filter overlap in-memory for mock/prisma variance
  rows = (rows || [])
    .filter((r) => {
      if (!args.includeCancelled && r.status === CRM_CALENDAR_EVENT_STATUS.CANCELLED) {
        return false;
      }
      return rangesOverlap(
        range.rangeStart,
        range.rangeEnd,
        new Date(r.startsAtUtc),
        new Date(r.endsAtUtc)
      );
    })
    .slice(0, limit);

  const events = rows.map((r) => serializeCalendarEvent(r, { availabilityOnly }));

  return {
    ok: true,
    view: range.view,
    rangeStart: range.rangeStart.toISOString(),
    rangeEnd: range.rangeEnd.toISOString(),
    timezone: args.timezone ? String(args.timezone).trim() : 'UTC',
    workingHours: { ...CRM_CALENDAR_DEFAULT_WORKING_HOURS },
    availabilityOnly,
    events,
    integrations: getCalendarIntegrationStatus(),
  };
}

/**
 * Export ICS for selected events (internal only — not external sync).
 */
export async function exportIcs(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canViewCalendar(access)) {
    return { ok: false, forbidden: true, reason: 'crm_calendar_export_forbidden' };
  }

  if (!hasCrmCalendarEventModel(prisma)) {
    return {
      ok: false,
      error: 'crm_calendar_event_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const eventIds = Array.isArray(args.eventIds)
    ? args.eventIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const ownerAdminId = args.ownerAdminId
    ? String(args.ownerAdminId).trim()
    : args.admin?.id || null;

  let rows = [];
  try {
    rows = await prisma.crmCalendarEvent.findMany({
      where: {
        ...(ownerAdminId ? { ownerAdminId } : {}),
      },
    });
  } catch {
    rows = [];
  }

  rows = (rows || []).filter(
    (r) => r.status !== CRM_CALENDAR_EVENT_STATUS.CANCELLED
  );
  if (eventIds.length) {
    const set = new Set(eventIds);
    rows = rows.filter((r) => set.has(r.id));
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//InsightBooks//CRM Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const row of rows || []) {
    const dtStart = toIcsUtc(row.startsAtUtc);
    const dtEnd = toIcsUtc(row.endsAtUtc);
    if (!dtStart || !dtEnd) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${icsEscape(row.id)}@insightbooks.crm`);
    lines.push(`DTSTAMP:${toIcsUtc(new Date())}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${icsEscape(row.title || 'CRM Meeting')}`);
    if (row.location) lines.push(`LOCATION:${icsEscape(row.location)}`);
    if (row.timezone) lines.push(`X-WR-TIMEZONE:${icsEscape(row.timezone)}`);
    if (row.activityId) lines.push(`X-CRM-ACTIVITY-ID:${icsEscape(row.activityId)}`);
    if (row.meetingId) lines.push(`X-CRM-MEETING-ID:${icsEscape(row.meetingId)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return {
    ok: true,
    ics: lines.join('\r\n'),
    eventCount: rows.length,
    externalSync: false,
    integrations: getCalendarIntegrationStatus(),
  };
}

/**
 * Create an internal calendar event linked to Activity (+ optional Meeting).
 * Used by Meeting service — not a public invent path for external Events.
 */
export async function createCalendarEventForMeeting(prisma, args = {}) {
  if (!hasCrmCalendarEventModel(prisma)) {
    return {
      ok: false,
      error: 'crm_calendar_event_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const access = resolveCrmAccess(args.admin);
  if (!canEditCalendar(access) && !args.internalTrusted) {
    return { ok: false, forbidden: true, reason: 'crm_calendar_create_forbidden' };
  }

  const startsAtUtc = toUtcDate(args.startsAtUtc);
  const endsAtUtc = toUtcDate(args.endsAtUtc);
  if (!startsAtUtc || !endsAtUtc) {
    return { ok: false, error: 'startsAt_and_endsAt_required' };
  }
  if (endsAtUtc <= startsAtUtc) {
    return { ok: false, error: 'end_before_start' };
  }

  const timezone = args.timezone ? String(args.timezone).trim() : null;
  if (!timezone) {
    return { ok: false, error: 'timezone_required' };
  }

  const now = args.now || new Date();
  const row = await prisma.crmCalendarEvent.create({
    data: {
      activityId: args.activityId || null,
      meetingId: args.meetingId || null,
      title: args.title != null ? String(args.title).trim().slice(0, 500) : 'Meeting',
      startsAtUtc,
      endsAtUtc,
      timezone,
      ownerAdminId: args.ownerAdminId || args.admin?.id || null,
      visibility: args.visibility || 'PUBLIC',
      status: CRM_CALENDAR_EVENT_STATUS.SCHEDULED,
      location: args.location != null ? String(args.location).slice(0, 500) : null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    event: serializeCalendarEvent(row),
    integrations: getCalendarIntegrationStatus(),
  };
}

export { canViewCalendar, canEditCalendar };
