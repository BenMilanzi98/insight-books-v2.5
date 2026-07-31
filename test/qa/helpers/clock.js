/**
 * Deterministic test clock — avoids wall-clock flakiness in period/expiry tests.
 */

let frozenMs = null;

export function freezeTime(isoOrMs) {
  if (typeof isoOrMs === 'number') frozenMs = isoOrMs;
  else frozenMs = new Date(isoOrMs).getTime();
  return frozenMs;
}

export function unfreezeTime() {
  frozenMs = null;
}

export function nowMs() {
  return frozenMs == null ? Date.now() : frozenMs;
}

export function nowDate() {
  return new Date(nowMs());
}

export function advanceMs(delta) {
  if (frozenMs == null) freezeTime(Date.now());
  frozenMs += Number(delta);
  return frozenMs;
}

/** Business-local calendar helpers (UTC date parts for determinism). */
export function utcYmd(date = nowDate()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
