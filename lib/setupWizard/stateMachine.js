/**
 * Business Setup Run / Step state machine.
 */

import { SETUP_RUN_STATUS, SETUP_STEP_STATUS } from './constants.js';
import { InvalidSetupTransitionError } from './errors.js';

/** @type {Readonly<Record<string, readonly string[]>>} */
export const RUN_TRANSITIONS = Object.freeze({
  [SETUP_RUN_STATUS.NOT_STARTED]: [
    SETUP_RUN_STATUS.IN_PROGRESS,
    SETUP_RUN_STATUS.CANCELLED,
  ],
  [SETUP_RUN_STATUS.IN_PROGRESS]: [
    SETUP_RUN_STATUS.WAITING_FOR_INFORMATION,
    SETUP_RUN_STATUS.READY_FOR_REVIEW,
    SETUP_RUN_STATUS.CANCELLED,
  ],
  [SETUP_RUN_STATUS.WAITING_FOR_INFORMATION]: [
    SETUP_RUN_STATUS.IN_PROGRESS,
    SETUP_RUN_STATUS.READY_FOR_REVIEW,
    SETUP_RUN_STATUS.CANCELLED,
  ],
  [SETUP_RUN_STATUS.READY_FOR_REVIEW]: [
    SETUP_RUN_STATUS.UNDER_REVIEW,
    SETUP_RUN_STATUS.IN_PROGRESS,
    SETUP_RUN_STATUS.CANCELLED,
  ],
  [SETUP_RUN_STATUS.UNDER_REVIEW]: [
    SETUP_RUN_STATUS.CHANGES_REQUIRED,
    SETUP_RUN_STATUS.APPROVED,
    SETUP_RUN_STATUS.IN_PROGRESS,
  ],
  [SETUP_RUN_STATUS.CHANGES_REQUIRED]: [
    SETUP_RUN_STATUS.IN_PROGRESS,
    SETUP_RUN_STATUS.READY_FOR_REVIEW,
    SETUP_RUN_STATUS.CANCELLED,
  ],
  [SETUP_RUN_STATUS.APPROVED]: [
    SETUP_RUN_STATUS.POSTING,
    SETUP_RUN_STATUS.IN_PROGRESS, // material change invalidates → back via service
  ],
  [SETUP_RUN_STATUS.POSTING]: [
    SETUP_RUN_STATUS.COMPLETED,
    SETUP_RUN_STATUS.COMPLETED_WITH_WARNINGS,
    SETUP_RUN_STATUS.POSTING_FAILED,
  ],
  [SETUP_RUN_STATUS.POSTING_FAILED]: [
    SETUP_RUN_STATUS.APPROVED,
    SETUP_RUN_STATUS.IN_PROGRESS,
    SETUP_RUN_STATUS.CANCELLED,
  ],
  [SETUP_RUN_STATUS.COMPLETED]: [
    SETUP_RUN_STATUS.REOPEN_REQUESTED,
  ],
  [SETUP_RUN_STATUS.COMPLETED_WITH_WARNINGS]: [
    SETUP_RUN_STATUS.REOPEN_REQUESTED,
  ],
  [SETUP_RUN_STATUS.REOPEN_REQUESTED]: [
    SETUP_RUN_STATUS.REOPENED,
    SETUP_RUN_STATUS.COMPLETED,
    SETUP_RUN_STATUS.COMPLETED_WITH_WARNINGS,
  ],
  [SETUP_RUN_STATUS.REOPENED]: [
    SETUP_RUN_STATUS.IN_PROGRESS,
    SETUP_RUN_STATUS.REVERSED,
  ],
  [SETUP_RUN_STATUS.REVERSED]: [],
  [SETUP_RUN_STATUS.CANCELLED]: [],
});

/** @type {Readonly<Record<string, readonly string[]>>} */
export const STEP_TRANSITIONS = Object.freeze({
  [SETUP_STEP_STATUS.NOT_STARTED]: [
    SETUP_STEP_STATUS.IN_PROGRESS,
    SETUP_STEP_STATUS.COMPLETED,
    SETUP_STEP_STATUS.COMPLETED_WITH_WARNINGS,
    SETUP_STEP_STATUS.BLOCKED,
    SETUP_STEP_STATUS.SKIPPED_OPTIONAL,
  ],
  [SETUP_STEP_STATUS.IN_PROGRESS]: [
    SETUP_STEP_STATUS.COMPLETED,
    SETUP_STEP_STATUS.COMPLETED_WITH_WARNINGS,
    SETUP_STEP_STATUS.REQUIRES_REVIEW,
    SETUP_STEP_STATUS.BLOCKED,
    SETUP_STEP_STATUS.SKIPPED_OPTIONAL,
    SETUP_STEP_STATUS.NOT_STARTED,
  ],
  [SETUP_STEP_STATUS.COMPLETED]: [
    SETUP_STEP_STATUS.IN_PROGRESS,
    SETUP_STEP_STATUS.REQUIRES_REVIEW,
    SETUP_STEP_STATUS.APPROVED,
    SETUP_STEP_STATUS.POSTED,
  ],
  [SETUP_STEP_STATUS.COMPLETED_WITH_WARNINGS]: [
    SETUP_STEP_STATUS.IN_PROGRESS,
    SETUP_STEP_STATUS.REQUIRES_REVIEW,
    SETUP_STEP_STATUS.APPROVED,
    SETUP_STEP_STATUS.POSTED,
  ],
  [SETUP_STEP_STATUS.BLOCKED]: [
    SETUP_STEP_STATUS.NOT_STARTED,
    SETUP_STEP_STATUS.IN_PROGRESS,
  ],
  [SETUP_STEP_STATUS.SKIPPED_OPTIONAL]: [
    SETUP_STEP_STATUS.NOT_STARTED,
    SETUP_STEP_STATUS.IN_PROGRESS,
  ],
  [SETUP_STEP_STATUS.REQUIRES_REVIEW]: [
    SETUP_STEP_STATUS.IN_PROGRESS,
    SETUP_STEP_STATUS.COMPLETED,
    SETUP_STEP_STATUS.APPROVED,
  ],
  [SETUP_STEP_STATUS.APPROVED]: [
    SETUP_STEP_STATUS.POSTED,
    SETUP_STEP_STATUS.IN_PROGRESS,
  ],
  [SETUP_STEP_STATUS.POSTED]: [],
});

/**
 * @param {string} from
 * @param {string} to
 */
export function canTransitionRun(from, to) {
  if (from === to) return true;
  return Boolean(RUN_TRANSITIONS[from]?.includes(to));
}

/**
 * @param {string} from
 * @param {string} to
 * @param {object} [options]
 */
export function assertRunTransition(from, to, options = {}) {
  if (!canTransitionRun(from, to)) {
    throw new InvalidSetupTransitionError(from, to, options);
  }
}

/**
 * @param {string} from
 * @param {string} to
 */
export function canTransitionStep(from, to) {
  if (from === to) return true;
  return Boolean(STEP_TRANSITIONS[from]?.includes(to));
}

/**
 * @param {string} from
 * @param {string} to
 * @param {object} [options]
 */
export function assertStepTransition(from, to, options = {}) {
  if (!canTransitionStep(from, to)) {
    throw new InvalidSetupTransitionError(from, to, options);
  }
}

/**
 * Steps that count toward completion percentage.
 * @param {{ status: string, optional?: boolean }} step
 */
export function isStepCountedComplete(step) {
  return (
    step.status === SETUP_STEP_STATUS.COMPLETED ||
    step.status === SETUP_STEP_STATUS.COMPLETED_WITH_WARNINGS ||
    step.status === SETUP_STEP_STATUS.SKIPPED_OPTIONAL ||
    step.status === SETUP_STEP_STATUS.APPROVED ||
    step.status === SETUP_STEP_STATUS.POSTED
  );
}

/**
 * @param {Array<{ status: string }>} steps
 */
export function computeCompletionPercent(steps) {
  if (!steps?.length) return 0;
  const done = steps.filter(isStepCountedComplete).length;
  return Math.round((done / steps.length) * 100);
}
