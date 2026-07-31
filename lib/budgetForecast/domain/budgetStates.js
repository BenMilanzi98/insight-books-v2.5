export const BUDGET_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  IN_PREPARATION: 'IN_PREPARATION',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  IN_REVIEW: 'IN_REVIEW',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  APPROVED: 'APPROVED',
  ACTIVE: 'ACTIVE',
  LOCKED: 'LOCKED',
  SUPERSEDED: 'SUPERSEDED',
  ARCHIVED: 'ARCHIVED',
  CANCELLED: 'CANCELLED',
});

const TRANSITIONS = Object.freeze({
  DRAFT: ['IN_PREPARATION', 'READY_FOR_REVIEW', 'CANCELLED'],
  IN_PREPARATION: ['READY_FOR_REVIEW', 'DRAFT', 'CANCELLED'],
  READY_FOR_REVIEW: ['IN_REVIEW', 'IN_PREPARATION', 'CANCELLED'],
  IN_REVIEW: ['APPROVED', 'CHANGES_REQUESTED', 'CANCELLED'],
  CHANGES_REQUESTED: ['IN_PREPARATION', 'READY_FOR_REVIEW', 'CANCELLED'],
  APPROVED: ['ACTIVE', 'LOCKED', 'SUPERSEDED'],
  ACTIVE: ['LOCKED', 'SUPERSEDED', 'ARCHIVED'],
  LOCKED: ['ACTIVE', 'SUPERSEDED', 'ARCHIVED'],
  SUPERSEDED: ['ARCHIVED'],
  ARCHIVED: [],
  CANCELLED: [],
});

export const EDITABLE_BUDGET_STATUSES = new Set([
  BUDGET_STATUS.DRAFT,
  BUDGET_STATUS.IN_PREPARATION,
  BUDGET_STATUS.CHANGES_REQUESTED,
]);

export function canEditBudget(status) {
  return EDITABLE_BUDGET_STATUSES.has(String(status || '').toUpperCase());
}

export function assertBudgetTransition(from, to) {
  const f = String(from || '').toUpperCase();
  const t = String(to || '').toUpperCase();
  const allowed = TRANSITIONS[f] || [];
  if (!allowed.includes(t)) {
    const err = new Error(`Invalid budget transition ${f} → ${t}`);
    err.code = 'INVALID_BUDGET_TRANSITION';
    err.status = 400;
    throw err;
  }
  return t;
}

/** Alias used by application command handlers. */
export const assertTransition = assertBudgetTransition;

export function allowedBudgetTransitions(from) {
  return [...(TRANSITIONS[String(from || '').toUpperCase()] || [])];
}

/** Intent command → target status */
export const BUDGET_COMMANDS = Object.freeze({
  submitForReview: BUDGET_STATUS.READY_FOR_REVIEW,
  startReview: BUDGET_STATUS.IN_REVIEW,
  requestChanges: BUDGET_STATUS.CHANGES_REQUESTED,
  approve: BUDGET_STATUS.APPROVED,
  activate: BUDGET_STATUS.ACTIVE,
  lock: BUDGET_STATUS.LOCKED,
  unlock: BUDGET_STATUS.ACTIVE,
  supersede: BUDGET_STATUS.SUPERSEDED,
  archive: BUDGET_STATUS.ARCHIVED,
  cancel: BUDGET_STATUS.CANCELLED,
});
