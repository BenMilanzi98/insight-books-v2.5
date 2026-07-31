/**
 * Bounded calendar range helpers — day/week/month/agenda.
 */

import { CRM_CALENDAR_MAX_RANGE_DAYS, CRM_CALENDAR_VIEW } from './catalogue.js';

/**
 * @param {string|Date} dateInput
 * @param {string} view
 * @returns {{ ok: true, rangeStart: Date, rangeEnd: Date, view: string } | { ok: false, error: string }}
 */
export function resolveCalendarRange(dateInput, view = CRM_CALENDAR_VIEW.DAY) {
  const v = String(view || CRM_CALENDAR_VIEW.DAY).trim().toLowerCase();
  const base = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(base.getTime())) {
    return { ok: false, error: 'invalid_date' };
  }

  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const d = base.getUTCDate();

  if (v === CRM_CALENDAR_VIEW.DAY) {
    const rangeStart = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    const rangeEnd = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));
    return { ok: true, rangeStart, rangeEnd, view: v };
  }

  if (v === CRM_CALENDAR_VIEW.WEEK) {
    const dow = base.getUTCDay(); // 0=Sun
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const rangeStart = new Date(Date.UTC(y, m, d + mondayOffset, 0, 0, 0, 0));
    const rangeEnd = new Date(rangeStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { ok: true, rangeStart, rangeEnd, view: v };
  }

  if (v === CRM_CALENDAR_VIEW.MONTH) {
    const rangeStart = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
    const rangeEnd = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
    return { ok: true, rangeStart, rangeEnd, view: v };
  }

  if (v === CRM_CALENDAR_VIEW.AGENDA) {
    const rangeStart = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    const rangeEnd = new Date(
      rangeStart.getTime() + CRM_CALENDAR_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000
    );
    return { ok: true, rangeStart, rangeEnd, view: v };
  }

  return { ok: false, error: 'invalid_calendar_view' };
}

/**
 * Overlap: A starts before B ends AND A ends after B starts.
 */
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}
