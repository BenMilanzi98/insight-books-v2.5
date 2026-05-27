// lib/dateUtils.js
import { parseMoney } from '@/lib/money';

/**
 * Start of month (1st day at 00:00:00) for a given date.
 * Used for payroll and recurring entries so periods default to full calendar months.
 * @param {Date|string} date - Any date in the month
 * @returns {Date} 1st day of that month at 00:00:00
 */
export function startOfMonth(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * End of month (last day at 23:59:59.999) for a given date.
 * Used for payroll and recurring entries for correct monthly reporting.
 * @param {Date|string} date - Any date in the month
 * @returns {Date} Last day of that month at 23:59:59.999
 */
export function endOfMonth(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth() + 1, 0, 23, 59, 59, 999);
  }
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * End of the same calendar day (23:59:59.999 local) for inclusive dashboard / report ranges.
 * Fixes `new Date(y, m+1, 0)` which is midnight on the last day and excludes records later that day.
 * @param {Date|string} date
 * @returns {Date}
 */
export function endOfLocalDay(date) {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  if (Number.isNaN(d.getTime())) return d;
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Normalize a period to the full month: start = 1st of month, end = last day of month.
 * Uses the start date's month for both.
 * @param {Date|string} periodStart - Start date (any day in the month)
 * @param {Date|string} periodEnd - End date (optional; if provided, its month is ignored; start's month is used)
 * @returns {{ start: Date, end: Date }}
 */
export function normalizeToMonthBounds(periodStart, periodEnd) {
  const start = startOfMonth(periodStart);
  const end = endOfMonth(periodEnd != null ? periodEnd : periodStart);
  return { start, end };
}

/** Default IANA zone for report / dashboard period boundaries (business calendar). */
export const DEFAULT_REPORT_TIMEZONE = 'Africa/Blantyre';

/**
 * Calendar (year, 0-indexed month, day) for an instant in a given time zone.
 * @param {Date} [date]
 * @param {string} [timeZone]
 * @returns {{ y: number, m0: number, d: number }}
 */
export function getCalendarPartsInTimeZone(date = new Date(), timeZone = DEFAULT_REPORT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m0 = Number(parts.find((p) => p.type === 'month')?.value) - 1;
  const d = Number(parts.find((p) => p.type === 'day')?.value);
  if (!Number.isFinite(y) || !Number.isFinite(m0) || !Number.isFinite(d)) {
    const f = new Date();
    return { y: f.getFullYear(), m0: f.getMonth(), d: f.getDate() };
  }
  return { y, m0, d };
}

function civilDaysInMonth(y, m0) {
  return new Date(Date.UTC(y, m0 + 1, 0, 12, 0, 0, 0)).getUTCDate();
}

/** Stable instant for civil date so formatYmdInTimeZone matches the intended calendar day. */
export function civilDateToUtcNoon(y, m0, d) {
  return new Date(Date.UTC(y, m0, d, 12, 0, 0, 0));
}

function addCalendarDays(y, m0, d, deltaDays) {
  const ms = Date.UTC(y, m0, d, 12, 0, 0, 0) + deltaDays * 86400000;
  const u = new Date(ms);
  return { y: u.getUTCFullYear(), m0: u.getUTCMonth(), d: u.getUTCDate() };
}

function civilRange(y1, m01, d1, y2, m02, d2) {
  return {
    startDate: civilDateToUtcNoon(y1, m01, d1),
    endDate: civilDateToUtcNoon(y2, m02, d2),
  };
}

/**
 * Parse a calendar date `YYYY-MM-DD` as UTC noon on that civil day (no off-by-one from `new Date('YYYY-MM-DD')` UTC midnight).
 * Use before {@link startOfMonth}/{@link endOfMonth} when reading API/query date-only strings.
 * @param {string} ymd
 * @returns {Date}
 */
export function parseYmdToUtcNoon(ymd) {
  const m = String(ymd || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return new Date(NaN);
  return civilDateToUtcNoon(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Parse API date fields for payroll month normalization: `YYYY-MM-DD` uses calendar parts (not UTC midnight);
 * other strings fall back to `Date.parse` semantics.
 * @param {string|Date|number} value
 * @returns {Date}
 */
export function parseDateInputForMonthNormalization(value) {
  const s = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return parseYmdToUtcNoon(s);
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(NaN) : d;
}

/**
 * Number of days in a calendar month (UTC civil), 0-indexed month.
 * @param {number} y
 * @param {number} m0 0–11
 */
export function civilDaysInMonthUtc(y, m0) {
  return new Date(Date.UTC(y, m0 + 1, 0, 12, 0, 0, 0)).getUTCDate();
}

/**
 * Payroll is always one **calendar month**: the month of `periodStart` (first day 00:00 UTC → last day 23:59:59.999 UTC).
 * Do not use {@link startOfMonth}/{@link endOfMonth} on UTC-noon parsed dates — in UTC+13/+14 the local calendar can roll
 * into the next month and `endOfMonth` would incorrectly yield October when September was intended.
 *
 * Accepts `YYYY-MM-DD` or any string/Date that begins with `YYYY-MM-DD` (e.g. ISO timestamps).
 *
 * @param {string|Date|number} periodStartInput
 * @param {string|Date|number} [periodEndInput] fallback only when start cannot be parsed as YMD
 * @returns {{ periodStart: Date, periodEnd: Date }}
 */
export function normalizePayrollMonthPeriod(periodStartInput, periodEndInput) {
  const head = String(periodStartInput ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (head) {
    const y = Number(head[1]);
    const m0 = Number(head[2]) - 1;
    if (Number.isFinite(y) && m0 >= 0 && m0 <= 11) {
      const last = civilDaysInMonthUtc(y, m0);
      const periodStart = new Date(Date.UTC(y, m0, 1, 0, 0, 0, 0));
      const periodEnd = new Date(Date.UTC(y, m0, last, 23, 59, 59, 999));
      return { periodStart, periodEnd };
    }
  }
  const rawStart = parseDateInputForMonthNormalization(periodStartInput);
  const rawEnd = parseDateInputForMonthNormalization(periodEndInput ?? periodStartInput);
  return {
    periodStart: startOfMonth(rawStart),
    periodEnd: endOfMonth(rawEnd),
  };
}

/**
 * `YYYY-MM-DD` using the runtime **local** calendar (browser or Node process TZ).
 * Use for `<input type="date">`, query params, and API payloads—**not** `toISOString().split('T')[0]`, which is UTC and shifts civil dates.
 * @param {Date|string|number} value
 * @returns {string} Empty string if unparseable
 */
export function toYmdLocal(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today's date as local `YYYY-MM-DD`. */
export function todayYmdLocal() {
  return toYmdLocal(new Date());
}

/**
 * First and last calendar day of a month as local `YYYY-MM-DD` (month is **1-based**: 1 = January).
 * @param {number} year
 * @param {number} month1
 * @returns {{ startYmd: string, endYmd: string }}
 */
export function calendarMonthYmdRangeLocal(year, month1) {
  const m0 = month1 - 1;
  const start = new Date(year, m0, 1);
  const end = new Date(year, m0 + 1, 0);
  return { startYmd: toYmdLocal(start), endYmd: toYmdLocal(end) };
}

/**
 * Calculate date range based on timeframe string.
 * Periods use the calendar in {@link DEFAULT_REPORT_TIMEZONE}: month = 1st–last day; quarter = Jan–Mar / Apr–Jun / Jul–Sep / Oct–Dec;
 * year = 1 Jan–31 Dec; week = Sunday–Saturday (ISO weekday 0 = Sunday).
 * @param {string} timeframe - today, yesterday, thisWeek, lastWeek, thisMonth, lastMonth, thisQuarter, lastQuarter, thisYear, lastYear, last7Days, last30Days, last90Days, last365Days, allTime, custom
 * @param {boolean} [previous] - Return the period before the selected one (for comparisons)
 * @param {{ startDate: string, endDate: string }|null} [customRange] - For timeframe === 'custom'
 * @returns {{ startDate: Date, endDate: Date }}
 */
export function calculateDateRange(timeframe, previous = false, customRange = null) {
  const tz = DEFAULT_REPORT_TIMEZONE;

  if (timeframe === 'custom' && customRange?.startDate && customRange?.endDate) {
    return {
      startDate: parseYmdToUtcNoon(customRange.startDate),
      endDate: parseYmdToUtcNoon(customRange.endDate),
    };
  }

  const { y: cy, m0: cm, d: cd } = getCalendarPartsInTimeZone(new Date(), tz);

  /** Sunday (inclusive) … Saturday (inclusive) of the week containing (y,m0,d). */
  const weekSunToSat = (y, m0, d) => {
    const dow = new Date(Date.UTC(y, m0, d, 12, 0, 0, 0)).getUTCDay();
    const sun = addCalendarDays(y, m0, d, -dow);
    const sat = addCalendarDays(sun.y, sun.m0, sun.d, 6);
    return civilRange(sun.y, sun.m0, sun.d, sat.y, sat.m0, sat.d);
  };

  switch (timeframe) {
    case 'today': {
      const t = !previous ? { y: cy, m0: cm, d: cd } : addCalendarDays(cy, cm, cd, -1);
      return civilRange(t.y, t.m0, t.d, t.y, t.m0, t.d);
    }
    case 'yesterday': {
      const yday = !previous ? addCalendarDays(cy, cm, cd, -1) : addCalendarDays(cy, cm, cd, -2);
      return civilRange(yday.y, yday.m0, yday.d, yday.y, yday.m0, yday.d);
    }
    case 'thisWeek':
      if (!previous) return weekSunToSat(cy, cm, cd);
      {
        const thisSun = addCalendarDays(cy, cm, cd, -new Date(Date.UTC(cy, cm, cd, 12, 0, 0, 0)).getUTCDay());
        const prevSun = addCalendarDays(thisSun.y, thisSun.m0, thisSun.d, -7);
        const prevSat = addCalendarDays(prevSun.y, prevSun.m0, prevSun.d, 6);
        return civilRange(prevSun.y, prevSun.m0, prevSun.d, prevSat.y, prevSat.m0, prevSat.d);
      }
    case 'lastWeek': {
      const dow = new Date(Date.UTC(cy, cm, cd, 12, 0, 0, 0)).getUTCDay();
      const thisSun = addCalendarDays(cy, cm, cd, -dow);
      if (!previous) {
        const start = addCalendarDays(thisSun.y, thisSun.m0, thisSun.d, -7);
        const end = addCalendarDays(thisSun.y, thisSun.m0, thisSun.d, -1);
        return civilRange(start.y, start.m0, start.d, end.y, end.m0, end.d);
      }
      const start = addCalendarDays(thisSun.y, thisSun.m0, thisSun.d, -14);
      const end = addCalendarDays(thisSun.y, thisSun.m0, thisSun.d, -8);
      return civilRange(start.y, start.m0, start.d, end.y, end.m0, end.d);
    }
    case 'thisMonth': {
      if (!previous) {
        const last = civilDaysInMonth(cy, cm);
        return civilRange(cy, cm, 1, cy, cm, last);
      }
      const pm = cm === 0 ? 11 : cm - 1;
      const py = cm === 0 ? cy - 1 : cy;
      const last = civilDaysInMonth(py, pm);
      return civilRange(py, pm, 1, py, pm, last);
    }
    case 'lastMonth': {
      if (!previous) {
        const pm = cm === 0 ? 11 : cm - 1;
        const py = cm === 0 ? cy - 1 : cy;
        const last = civilDaysInMonth(py, pm);
        return civilRange(py, pm, 1, py, pm, last);
      }
      let yy = cy;
      let m = cm - 2;
      while (m < 0) {
        m += 12;
        yy -= 1;
      }
      const last = civilDaysInMonth(yy, m);
      return civilRange(yy, m, 1, yy, m, last);
    }
    case 'thisQuarter': {
      const q = Math.floor(cm / 3);
      if (!previous) {
        const sm = q * 3;
        const em = sm + 2;
        const last = civilDaysInMonth(cy, em);
        return civilRange(cy, sm, 1, cy, em, last);
      }
      const pq = q === 0 ? 3 : q - 1;
      const py = q === 0 ? cy - 1 : cy;
      const sm = pq * 3;
      const em = sm + 2;
      const last = civilDaysInMonth(py, em);
      return civilRange(py, sm, 1, py, em, last);
    }
    case 'lastQuarter': {
      const currentQ = Math.floor(cm / 3);
      const lastQ = currentQ === 0 ? 3 : currentQ - 1;
      const lastQY = currentQ === 0 ? cy - 1 : cy;
      if (!previous) {
        const sm = lastQ * 3;
        const em = sm + 2;
        const last = civilDaysInMonth(lastQY, em);
        return civilRange(lastQY, sm, 1, lastQY, em, last);
      }
      const prevQ = lastQ === 0 ? 3 : lastQ - 1;
      const prevQY = lastQ === 0 ? lastQY - 1 : lastQY;
      const sm = prevQ * 3;
      const em = sm + 2;
      const last = civilDaysInMonth(prevQY, em);
      return civilRange(prevQY, sm, 1, prevQY, em, last);
    }
    case 'thisYear':
      if (!previous) return civilRange(cy, 0, 1, cy, 11, 31);
      return civilRange(cy - 1, 0, 1, cy - 1, 11, 31);
    case 'lastYear':
      if (!previous) return civilRange(cy - 1, 0, 1, cy - 1, 11, 31);
      return civilRange(cy - 2, 0, 1, cy - 2, 11, 31);
    case 'last7Days': {
      const end = !previous ? { y: cy, m0: cm, d: cd } : addCalendarDays(cy, cm, cd, -8);
      const start = addCalendarDays(end.y, end.m0, end.d, !previous ? -7 : -14);
      return civilRange(start.y, start.m0, start.d, end.y, end.m0, end.d);
    }
    case 'last30Days': {
      const end = !previous ? { y: cy, m0: cm, d: cd } : addCalendarDays(cy, cm, cd, -31);
      const start = addCalendarDays(end.y, end.m0, end.d, !previous ? -30 : -60);
      return civilRange(start.y, start.m0, start.d, end.y, end.m0, end.d);
    }
    case 'last90Days': {
      const end = !previous ? { y: cy, m0: cm, d: cd } : addCalendarDays(cy, cm, cd, -91);
      const start = addCalendarDays(end.y, end.m0, end.d, !previous ? -90 : -180);
      return civilRange(start.y, start.m0, start.d, end.y, end.m0, end.d);
    }
    case 'last365Days': {
      const end = !previous ? { y: cy, m0: cm, d: cd } : addCalendarDays(cy, cm, cd, -366);
      const start = addCalendarDays(end.y, end.m0, end.d, !previous ? -365 : -730);
      return civilRange(start.y, start.m0, start.d, end.y, end.m0, end.d);
    }
    case 'allTime':
      if (!previous) return civilRange(cy - 5, 0, 1, cy, 11, 31);
      return civilRange(cy - 10, 0, 1, cy - 5, 11, 31);
    default: {
      const last = civilDaysInMonth(cy, cm);
      return civilRange(cy, cm, 1, cy, cm, last);
    }
  }
}
  
  // Format currency to MWK format
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return 'MWK 0.00';
  const value = parseMoney(amount);
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MWK',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

// Calendar "today" in Africa/Blantyre as a stable Date (noon UTC for that civil date)
export function getCurrentDateInAfricaBlantyre() {
  const { y, m0, d } = getCalendarPartsInTimeZone(new Date(), DEFAULT_REPORT_TIMEZONE);
  return civilDateToUtcNoon(y, m0, d);
}

/**
 * Format a Date as YYYY-MM-DD in a specific timezone (default: Africa/Blantyre).
 * This avoids UTC offset issues from toISOString() that can shift dates back a day.
 */
export function formatYmdInTimeZone(date, timeZone = "Africa/Blantyre") {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  // en-CA produces YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Calendar day for display: YYYY-MM-DD (and ISO strings starting with that) are parsed as
 * local civil date so the UI does not shift a day vs UTC midnight parsing.
 * @param {Date|string|number|null|undefined} input
 * @returns {string} DD-MM-YYYY or 'N/A' / 'Invalid Date'
 */
export const formatDate = (input) => {
  if (input == null || input === '') return 'N/A';

  try {
    let date;
    if (input instanceof Date) {
      date = Number.isNaN(input.getTime()) ? null : input;
    } else {
      const s = String(input).trim();
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      } else {
        date = new Date(input);
      }
    }
    if (!date || Number.isNaN(date.getTime())) return 'Invalid Date';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (error) {
    return 'Invalid Date';
  }
};

/** YYYY-MM-DD → DD-MM-YYYY for report subtitles (no browser-local drift). */
function ymdToDmy(ymd) {
  const m = String(ymd || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Human-readable range for reports (DD-MM-YYYY … DD-MM-YYYY).
 * Uses {@link DEFAULT_REPORT_TIMEZONE} so "this month" / "this year" match calendar boundaries
 * from {@link calculateDateRange}, not the viewer's machine timezone.
 */
export function formatPeriodRange(start, end, separator = ' to ', timeZone = DEFAULT_REPORT_TIMEZONE) {
  if (start == null || end == null || start === '' || end === '') return '';
  const ys =
    typeof start === 'string' && /^\d{4}-\d{2}-\d{2}/.test(String(start).trim())
      ? String(start).trim().slice(0, 10)
      : formatYmdInTimeZone(start, timeZone);
  const ye =
    typeof end === 'string' && /^\d{4}-\d{2}-\d{2}/.test(String(end).trim())
      ? String(end).trim().slice(0, 10)
      : formatYmdInTimeZone(end, timeZone);
  if (!ys || !ye) return '';
  const a = ymdToDmy(ys);
  const b = ymdToDmy(ye);
  if (!a || !b) return '';
  return `${a}${separator}${b}`;
}

/**
 * Add calendar days to an ISO `YYYY-MM-DD` using UTC noon arithmetic (month/year rollover safe).
 * @param {string} ymd
 * @param {number} deltaDays
 * @returns {string}
 */
function addIsoYmdCalendarDays(ymd, deltaDays) {
  const m = String(ymd || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const u = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + deltaDays, 12, 0, 0, 0);
  const d = new Date(u);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * First instant (UTC) on which {@link formatYmdInTimeZone} equals `ymd` in the given zone (full civil day start).
 * @param {string} ymd `YYYY-MM-DD`
 * @param {string} [timeZone]
 * @returns {Date}
 */
function startOfReportCalendarDay(ymd, timeZone = DEFAULT_REPORT_TIMEZONE) {
  const s = String(ymd || '').trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!s) return new Date(NaN);
  const anchor = parseYmdToUtcNoon(s).getTime();
  const HOUR = 3600000;
  const maxShift = 30 * HOUR;
  let t = anchor;
  let shifted = 0;
  while (formatYmdInTimeZone(new Date(t), timeZone) !== s && shifted < maxShift) {
    t += HOUR;
    shifted += HOUR;
  }
  if (formatYmdInTimeZone(new Date(t), timeZone) !== s) return new Date(NaN);
  while (formatYmdInTimeZone(new Date(t - HOUR), timeZone) === s) t -= HOUR;
  const MS = 1000;
  while (formatYmdInTimeZone(new Date(t - MS), timeZone) === s) t -= MS;
  return new Date(t);
}

/**
 * Last instant (UTC) on the same civil `ymd` in `timeZone` (one ms before the next civil day starts).
 * @param {string} ymd `YYYY-MM-DD`
 * @param {string} [timeZone]
 * @returns {Date}
 */
function endOfReportCalendarDay(ymd, timeZone = DEFAULT_REPORT_TIMEZONE) {
  const s = String(ymd || '').trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!s) return new Date(NaN);
  const nextStart = startOfReportCalendarDay(addIsoYmdCalendarDays(s, 1), timeZone);
  if (Number.isNaN(nextStart.getTime())) return new Date(NaN);
  return new Date(nextStart.getTime() - 1);
}

/**
 * Parse API `YYYY-MM-DD` bounds as inclusive instants for the full civil calendar day(s) in
 * {@link DEFAULT_REPORT_TIMEZONE} (same calendar as {@link calculateDateRange} / {@link formatYmdInTimeZone}).
 * Avoids mixing "UTC end of day" with Blantyre-labelled dates (which truncated COGS/revenue to ~half a UTC day
 * and could label the period as spanning two local dates).
 * @param {string|Date} startInput
 * @param {string|Date} endInput
 * @returns {{ start: Date, end: Date }}
 */
export function parseInclusiveApiYmdRange(startInput, endInput) {
  const sHead = String(startInput ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  const eHead = String(endInput ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (sHead && eHead) {
    const startYmd = `${sHead[1]}-${sHead[2]}-${sHead[3]}`;
    const endYmd = `${eHead[1]}-${eHead[2]}-${eHead[3]}`;
    return {
      start: startOfReportCalendarDay(startYmd, DEFAULT_REPORT_TIMEZONE),
      end: endOfReportCalendarDay(endYmd, DEFAULT_REPORT_TIMEZONE),
    };
  }
  const start = startInput instanceof Date ? new Date(startInput.getTime()) : new Date(startInput);
  const end = endInput instanceof Date ? new Date(endInput.getTime()) : new Date(endInput);
  if (!Number.isNaN(start.getTime())) start.setHours(0, 0, 0, 0);
  if (!Number.isNaN(end.getTime())) end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Remove a trailing period range accidentally stored in category/account names
 * (e.g. recurring templates: "Electricity (01-04-2024 to 30-04-2024)").
 * Report period already appears in the header — keep row labels to CoA-style names only.
 * @param {string|null|undefined} label
 * @returns {string}
 */
export function stripEmbeddedPeriodFromReportLabel(label) {
  if (label == null || typeof label !== 'string') return '';
  let s = label.trim();
  if (!s) return '';
  // (DD-MM-YYYY to DD-MM-YYYY)
  s = s.replace(/\s*\(\d{1,2}-\d{1,2}-\d{4}\s+to\s+\d{1,2}-\d{1,2}-\d{4}\)\s*$/i, '');
  // (YYYY-MM-DD to YYYY-MM-DD)
  s = s.replace(/\s*\(\d{4}-\d{2}-\d{2}\s+to\s+\d{4}-\d{2}-\d{2}\)\s*$/i, '');
  return s.trim() || label.trim();
}

// Format date and time
export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Invalid Date';
  }
};

// Get relative time (e.g., "2 hours ago")
export const getRelativeTime = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  } catch (error) {
    return 'Invalid Date';
  }
};

// Check if date is today
export const isToday = (dateString) => {
  if (!dateString) return false;
  
  try {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  } catch (error) {
    return false;
  }
};

// Check if date is this week
export const isThisWeek = (dateString) => {
  if (!dateString) return false;
  
  try {
    const date = new Date(dateString);
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
    
    return date >= startOfWeek && date <= endOfWeek;
  } catch (error) {
    return false;
  }
};

// Check if date is this month
export const isThisMonth = (dateString) => {
  if (!dateString) return false;
  
  try {
    const date = new Date(dateString);
    const today = new Date();
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  } catch (error) {
    return false;
  }
};

  /**
   * Get a human-readable timeframe label
   * @param {string} timeframe - The timeframe string
   * @returns {string} Human-readable timeframe label
   */
  export function getTimeframeLabel(timeframe) {
    switch (timeframe) {
      case 'today':
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case 'thisWeek':
        return 'This Week';
      case 'lastWeek':
        return 'Last Week';
      case 'thisMonth':
        return 'This Month';
      case 'lastMonth':
        return 'Last Month';
      case 'thisQuarter':
        return 'This Quarter';
      case 'lastQuarter':
        return 'Last Quarter';
      case 'thisYear':
        return 'This Year';
      case 'lastYear':
        return 'Last Year';
      case 'last7Days':
        return 'Last 7 Days';
      case 'last30Days':
        return 'Last 30 Days';
      case 'last90Days':
        return 'Last 90 Days';
      case 'last365Days':
        return 'Last 365 Days';
      case 'allTime':
        return 'All Time';
      case 'custom':
        return 'Custom Range';
      case 'singleDay':
        return 'Single day';
      default:
        return 'Custom Range';
    }
  }

  /**
   * Get all available timeframes for date range selection
   * @returns {Array} Array of timeframe objects with value, label, and description
   */
  export function getAvailableTimeframes() {
    return [
      { value: 'today', label: 'Today', description: 'Current day' },
      { value: 'yesterday', label: 'Yesterday', description: 'Previous day' },
      { value: 'thisWeek', label: 'This Week', description: 'Current week (Sun-Sat)' },
      { value: 'thisMonth', label: 'This Month', description: '1st to last day of current month' },
      { value: 'lastMonth', label: 'Last Month', description: '1st to last day of previous month' },
      { value: 'thisQuarter', label: 'This Quarter', description: 'Calendar quarter (e.g. Q1: 1 Jan–31 Mar)' },
      { value: 'lastQuarter', label: 'Last Quarter', description: 'Previous calendar quarter' },
      { value: 'thisYear', label: 'This Year', description: '1 Jan–31 Dec' },
      { value: 'custom', label: 'Custom Range', description: 'Select custom dates' }
    ];
  }

  /**
   * Validate if a date range is valid
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Object} Object with isValid boolean and error message if invalid
   */
  export function validateDateRange(startDate, endDate) {
    if (!startDate || !endDate) {
      return { isValid: false, error: 'Both start and end dates are required' };
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { isValid: false, error: 'Invalid date format' };
    }
    
    if (start > end) {
      return { isValid: false, error: 'Start date cannot be after end date' };
    }
    
    
    return { isValid: true, error: null };
  }

  /**
   * Get default custom date range. Uses current calendar month (1st to last day) for financial alignment.
   * @returns {Object} Object with startDate and endDate in YYYY-MM-DD format
   */
  export function getDefaultCustomRange() {
    const { y, m0 } = getCalendarPartsInTimeZone(new Date(), DEFAULT_REPORT_TIMEZONE);
    const last = civilDaysInMonth(y, m0);
    const pad = (n) => String(n).padStart(2, '0');
    return {
      startDate: `${y}-${pad(m0 + 1)}-01`,
      endDate: `${y}-${pad(m0 + 1)}-${pad(last)}`,
    };
  }

  /**
   * Get date range based on selected range string (same rules as {@link calculateDateRange}).
   * @param {string} selectedRange
   * @returns {{ startDate: Date, endDate: Date }}
   */
  export function getDateRange(selectedRange) {
    return calculateDateRange(selectedRange);
  }