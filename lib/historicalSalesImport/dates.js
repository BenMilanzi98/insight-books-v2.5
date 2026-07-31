/**
 * Historical sales import — date parsing and calendar-day helpers.
 * Preferred format: YYYY-MM-DD. Also accepts DD/MM/YYYY and DD-MM-YYYY.
 */

/** @param {Date} d */
export function toDateOnlyString(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today at local midnight. */
export function startOfToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/**
 * Parse a date string into a local-midnight Date, or null.
 * @param {unknown} dateStr
 * @returns {Date|null}
 */
export function parseImportDate(dateStr) {
  if (dateStr == null) return null;
  const cleanStr = String(dateStr).trim();
  if (!cleanStr) return null;

  let date = null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
    const [y, m, d] = cleanStr.split('-').map((p) => parseInt(p, 10));
    date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
      return null;
    }
    return date;
  }

  if (cleanStr.includes('/')) {
    const parts = cleanStr.split('/').map((p) => p.trim());
    if (parts.length === 3) {
      let [a, b, c] = parts.map((p) => parseInt(p, 10));
      if ([a, b, c].some((n) => Number.isNaN(n))) return null;
      if (c < 100) c = c < 50 ? 2000 + c : 1900 + c;
      // Prefer DD/MM/YYYY (Malawi / EU)
      if (a > 31 && b >= 1 && b <= 12) {
        date = new Date(a, b - 1, c);
      } else {
        date = new Date(c, b - 1, a);
        if (date.getDate() !== a || date.getMonth() !== b - 1 || date.getFullYear() !== c) {
          return null;
        }
      }
    }
  } else if (cleanStr.includes('-')) {
    const parts = cleanStr.split('-').map((p) => p.trim());
    if (parts.length === 3) {
      const [a, b, c] = parts.map((p) => parseInt(p, 10));
      if ([a, b, c].some((n) => Number.isNaN(n))) return null;
      if (a > 31) {
        date = new Date(a, b - 1, c);
        if (date.getFullYear() !== a || date.getMonth() !== b - 1 || date.getDate() !== c) {
          return null;
        }
      } else {
        let year = c;
        if (c < 100) year = c < 50 ? 2000 + c : 1900 + c;
        date = new Date(year, b - 1, a);
        if (date.getDate() !== a || date.getMonth() !== b - 1 || date.getFullYear() !== year) {
          return null;
        }
      }
    }
  } else if (cleanStr.includes('.')) {
    const parts = cleanStr.split('.').map((p) => p.trim());
    if (parts.length === 3) {
      const [a, b, c] = parts.map((p) => parseInt(p, 10));
      if ([a, b, c].some((n) => Number.isNaN(n))) return null;
      if (c > 31) {
        date = new Date(c, b - 1, a);
      } else if (a > 31) {
        date = new Date(a, b - 1, c);
      }
    }
  }

  if (!date || Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isFutureDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return true;
  return date.getTime() > startOfToday().getTime();
}
