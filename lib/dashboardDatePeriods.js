/**
 * Dashboard date windows: use the server's local calendar day (00:00–23:59:59.999)
 * so Expense.date / Payment.paymentDate ranges match how data is stored and how
 * UniversalDateRangeFilter + getDateRange behave on the client.
 */
import { endOfLocalDay } from '@/lib/dateUtils';

/** @param {Date} [now] */
export function dashboardLocalTodayBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = endOfLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  return { start, end };
}

/** @param {Date} [now] */
export function dashboardLocalYesterdayBounds(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return {
    start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0),
    end: endOfLocalDay(d),
  };
}

/** Sunday 00:00:00 – Saturday 23:59:59.999 (local), same week as `now`. */
export function dashboardLocalThisWeekBounds(now = new Date()) {
  const sun = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  sun.setHours(0, 0, 0, 0);
  const sat = new Date(sun);
  sat.setDate(sun.getDate() + 6);
  return { start: sun, end: endOfLocalDay(sat) };
}

/** Previous calendar week (Sun–Sat local) immediately before this week. */
export function dashboardLocalLastWeekBounds(now = new Date()) {
  const { start: thisSun } = dashboardLocalThisWeekBounds(now);
  const prevSun = new Date(thisSun);
  prevSun.setDate(thisSun.getDate() - 7);
  const prevSat = new Date(thisSun);
  prevSat.setDate(thisSun.getDate() - 1);
  return { start: prevSun, end: endOfLocalDay(prevSat) };
}

/**
 * @param {{ start: Date, end: Date }} weekBounds
 * @returns {{ start: Date, end: Date }}
 */
export function dashboardLocalWeekBefore(weekBounds) {
  const start = new Date(weekBounds.start);
  start.setDate(weekBounds.start.getDate() - 7);
  const end = new Date(weekBounds.start);
  end.setDate(weekBounds.start.getDate() - 1);
  return { start, end: endOfLocalDay(end) };
}
