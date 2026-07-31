/**
 * Support SLA business calendars — timezone + working hours + holidays.
 */

import {
  SUPPORT_DEFAULT_SLA_CALENDAR_VERSION_ID,
} from './catalogue.js';

const WEEKDAY_MAP = Object.freeze({
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
});

/**
 * Default Support calendar (Africa/Blantyre, Mon–Fri 08:00–17:00, no holidays).
 */
export function getDefaultSlaCalendar() {
  return Object.freeze({
    versionId: SUPPORT_DEFAULT_SLA_CALENDAR_VERSION_ID,
    timezone: 'Africa/Blantyre',
    /** JS getDay()-style: 0=Sun … 6=Sat */
    workdays: Object.freeze([1, 2, 3, 4, 5]),
    workingHours: Object.freeze({ start: '08:00', end: '17:00' }),
    holidays: Object.freeze([]),
  });
}

function mapCalendarRow(row) {
  if (!row) return null;
  let definition = {};
  if (typeof row.definitionJson === 'string') {
    try {
      definition = JSON.parse(row.definitionJson) || {};
    } catch {
      definition = {};
    }
  } else if (row.definitionJson && typeof row.definitionJson === 'object') {
    definition = row.definitionJson;
  }
  return {
    versionId: row.versionId,
    timezone: row.timezone || definition.timezone || 'UTC',
    workdays: definition.workdays || [1, 2, 3, 4, 5],
    workingHours: definition.workingHours || { start: '08:00', end: '17:00' },
    holidays: definition.holidays || [],
    source: 'db',
  };
}

/**
 * Load a calendar by pinned version id. Catalogue default or DB row; null if missing.
 * Never invents a newer catalogue default for an unknown version.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} versionId
 * @returns {Promise<object|null>}
 */
export async function getSlaCalendarByVersion(prisma, versionId) {
  const id = String(versionId || '').trim();
  if (!id) return null;

  const catalogue = getDefaultSlaCalendar();
  if (id === catalogue.versionId) return catalogue;

  if (typeof prisma?.supportSlaCalendar?.findUnique === 'function') {
    try {
      const row = await prisma.supportSlaCalendar.findUnique({ where: { versionId: id } });
      if (row) return mapCalendarRow(row);
    } catch {
      // fall through
    }
  }
  if (typeof prisma?.supportSlaCalendar?.findFirst === 'function') {
    try {
      const row = await prisma.supportSlaCalendar.findFirst({ where: { versionId: id } });
      if (row) return mapCalendarRow(row);
    } catch {
      // fall through
    }
  }
  return null;
}

function parseHm(hm) {
  const [h, m] = String(hm || '00:00').split(':').map((n) => Number(n));
  return {
    hour: Number.isFinite(h) ? h : 0,
    minute: Number.isFinite(m) ? m : 0,
  };
}

function partsInZone(date, timeZone) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const parts = {};
  for (const p of f.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_MAP[parts.weekday] ?? 0,
  };
}

/**
 * Convert a wall-clock time in `timeZone` to a UTC Date.
 */
export function zonedLocalToUtc(year, month, day, hour, minute, timeZone) {
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 4; i += 1) {
    const p = partsInZone(new Date(utcMs), timeZone);
    const asLocal = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const want = Date.UTC(year, month - 1, day, hour, minute, 0);
    const delta = want - asLocal;
    if (delta === 0) break;
    utcMs += delta;
  }
  return new Date(utcMs);
}

function ymdKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isHoliday(year, month, day, calendar) {
  const key = ymdKey(year, month, day);
  const holidays = calendar?.holidays || [];
  return holidays.some((h) => String(h) === key);
}

function addLocalDays(year, month, day, days) {
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

/**
 * Elapsed business milliseconds between `from` and `to` under the pinned calendar.
 *
 * @param {Date|string|number} from
 * @param {Date|string|number} to
 * @param {ReturnType<typeof getDefaultSlaCalendar>} [calendar]
 * @returns {number}
 */
export function elapsedBusinessMs(from, to, calendar = getDefaultSlaCalendar()) {
  const start = new Date(from);
  const end = new Date(to);
  if (!(start.getTime() < end.getTime())) return 0;

  const timeZone = calendar.timezone || 'UTC';
  const workdays = new Set(calendar.workdays || [1, 2, 3, 4, 5]);
  const { hour: startH, minute: startM } = parseHm(calendar.workingHours?.start || '08:00');
  const { hour: endH, minute: endM } = parseHm(calendar.workingHours?.end || '17:00');

  const startParts = partsInZone(start, timeZone);
  const endParts = partsInZone(end, timeZone);

  let total = 0;
  let cursor = {
    year: startParts.year,
    month: startParts.month,
    day: startParts.day,
  };

  for (let guard = 0; guard < 370; guard += 1) {
    const dayStartUtc = zonedLocalToUtc(
      cursor.year,
      cursor.month,
      cursor.day,
      startH,
      startM,
      timeZone
    );
    const dayEndUtc = zonedLocalToUtc(
      cursor.year,
      cursor.month,
      cursor.day,
      endH,
      endM,
      timeZone
    );
    const dayParts = partsInZone(dayStartUtc, timeZone);
    const workday =
      workdays.has(dayParts.weekday) &&
      !isHoliday(cursor.year, cursor.month, cursor.day, calendar);

    if (workday) {
      const segStart = Math.max(start.getTime(), dayStartUtc.getTime());
      const segEnd = Math.min(end.getTime(), dayEndUtc.getTime());
      if (segEnd > segStart) total += segEnd - segStart;
    }

    if (
      cursor.year === endParts.year &&
      cursor.month === endParts.month &&
      cursor.day === endParts.day
    ) {
      break;
    }
    cursor = addLocalDays(cursor.year, cursor.month, cursor.day, 1);
  }

  return total;
}

/**
 * Add `businessMs` of working time after `from` under the pinned calendar.
 *
 * @param {Date|string|number} from
 * @param {number} businessMs
 * @param {ReturnType<typeof getDefaultSlaCalendar>} [calendar]
 * @returns {Date}
 */
export function addBusinessMs(from, businessMs, calendar = getDefaultSlaCalendar()) {
  const start = new Date(from);
  const target = Math.max(0, Number(businessMs) || 0);
  if (target === 0) return start;

  const timeZone = calendar.timezone || 'UTC';
  const workdays = new Set(calendar.workdays || [1, 2, 3, 4, 5]);
  const { hour: startH, minute: startM } = parseHm(calendar.workingHours?.start || '08:00');
  const { hour: endH, minute: endM } = parseHm(calendar.workingHours?.end || '17:00');

  let remaining = target;
  let cursorMs = start.getTime();
  const startParts = partsInZone(start, timeZone);
  let day = {
    year: startParts.year,
    month: startParts.month,
    day: startParts.day,
  };

  for (let guard = 0; guard < 3700 && remaining > 0; guard += 1) {
    const dayStartUtc = zonedLocalToUtc(day.year, day.month, day.day, startH, startM, timeZone);
    const dayEndUtc = zonedLocalToUtc(day.year, day.month, day.day, endH, endM, timeZone);
    const dayParts = partsInZone(dayStartUtc, timeZone);
    const workday =
      workdays.has(dayParts.weekday) && !isHoliday(day.year, day.month, day.day, calendar);

    if (workday) {
      const segStart = Math.max(cursorMs, dayStartUtc.getTime());
      const avail = dayEndUtc.getTime() - segStart;
      if (avail > 0) {
        if (remaining <= avail) {
          return new Date(segStart + remaining);
        }
        remaining -= avail;
        cursorMs = dayEndUtc.getTime();
      }
    }

    day = addLocalDays(day.year, day.month, day.day, 1);
    cursorMs = zonedLocalToUtc(day.year, day.month, day.day, startH, startM, timeZone).getTime();
  }

  return new Date(cursorMs + remaining);
}
