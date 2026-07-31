/**
 * Test-only failure injection points for Phase 16 atomicity / recovery tests.
 * DISABLED unless NODE_ENV=test AND QA_FAILURE_INJECTION=1.
 * Must never activate in production.
 */

const POINTS = new Set([
  'BEFORE_TX',
  'AFTER_SOURCE_LOCK',
  'AFTER_IDEMPOTENCY_RESERVE',
  'AFTER_JOURNAL_HEADER',
  'AFTER_FIRST_LINE',
  'BEFORE_JOURNAL_VALIDATE',
  'AFTER_JOURNAL_VALIDATE',
  'BEFORE_SOURCE_STATUS',
  'AFTER_SOURCE_STATUS',
  'BEFORE_OUTBOX',
  'AFTER_OUTBOX',
  'BEFORE_COMMIT',
  'AFTER_COMMIT',
]);

/** @type {Map<string, { remaining: number, error?: Error }>} */
const armed = new Map();

export function isFailureInjectionEnabled() {
  return process.env.NODE_ENV === 'test' && process.env.QA_FAILURE_INJECTION === '1';
}

export function listFailurePoints() {
  return [...POINTS];
}

/**
 * Arm a one-shot (or N-shot) failure at a named point.
 * No-op when injection is disabled.
 */
export function armFailure(point, { times = 1, message } = {}) {
  if (!isFailureInjectionEnabled()) return false;
  if (!POINTS.has(point)) {
    throw new Error(`Unknown failure injection point: ${point}`);
  }
  armed.set(point, {
    remaining: times,
    error: new Error(message || `Injected failure at ${point}`),
  });
  return true;
}

export function clearFailures() {
  armed.clear();
}

/**
 * Call at critical points in posting / recovery paths during tests.
 * Throws when armed; otherwise no-op.
 */
export function maybeFail(point) {
  if (!isFailureInjectionEnabled()) return;
  const entry = armed.get(point);
  if (!entry || entry.remaining <= 0) return;
  entry.remaining -= 1;
  if (entry.remaining <= 0) armed.delete(point);
  throw entry.error;
}

export function FailureInjectionDisabledError(message) {
  const e = new Error(message || 'Failure injection is disabled outside QA test runs.');
  e.code = 'QA_FAILURE_INJECTION_DISABLED';
  return e;
}
