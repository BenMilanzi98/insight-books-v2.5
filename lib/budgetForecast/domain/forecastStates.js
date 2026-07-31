export const FORECAST_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  GENERATING: 'GENERATING',
  GENERATED: 'GENERATED',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  ACTIVE: 'ACTIVE',
  LOCKED: 'LOCKED',
  SUPERSEDED: 'SUPERSEDED',
  ARCHIVED: 'ARCHIVED',
  FAILED: 'FAILED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

const TRANSITIONS = Object.freeze({
  DRAFT: ['GENERATING', 'IN_REVIEW', 'ARCHIVED'],
  GENERATING: ['GENERATED', 'FAILED'],
  GENERATED: ['IN_REVIEW', 'DRAFT', 'MANUAL_REVIEW'],
  IN_REVIEW: ['APPROVED', 'MANUAL_REVIEW', 'DRAFT'],
  MANUAL_REVIEW: ['IN_REVIEW', 'DRAFT'],
  APPROVED: ['ACTIVE', 'LOCKED', 'SUPERSEDED'],
  ACTIVE: ['LOCKED', 'SUPERSEDED', 'ARCHIVED'],
  LOCKED: ['ACTIVE', 'SUPERSEDED', 'ARCHIVED'],
  SUPERSEDED: ['ARCHIVED'],
  ARCHIVED: [],
  FAILED: ['DRAFT', 'GENERATING'],
});

export const EDITABLE_FORECAST_STATUSES = new Set([
  FORECAST_STATUS.DRAFT,
  FORECAST_STATUS.GENERATED,
  FORECAST_STATUS.MANUAL_REVIEW,
  FORECAST_STATUS.FAILED,
]);

export function canEditForecast(status) {
  return EDITABLE_FORECAST_STATUSES.has(String(status || '').toUpperCase());
}

export function assertForecastTransition(from, to) {
  const f = String(from || '').toUpperCase();
  const t = String(to || '').toUpperCase();
  const allowed = TRANSITIONS[f] || [];
  if (!allowed.includes(t)) {
    const err = new Error(`Invalid forecast transition ${f} → ${t}`);
    err.code = 'INVALID_FORECAST_TRANSITION';
    err.status = 400;
    throw err;
  }
  return t;
}

/** Alias used by application command handlers. */
export const assertTransition = assertForecastTransition;

export function allowedForecastTransitions(from) {
  return [...(TRANSITIONS[String(from || '').toUpperCase()] || [])];
}
