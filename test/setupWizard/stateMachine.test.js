import { describe, it, expect } from 'vitest';
import {
  canTransitionRun,
  assertRunTransition,
  canTransitionStep,
  computeCompletionPercent,
} from '../../lib/setupWizard/stateMachine.js';
import { SETUP_RUN_STATUS, SETUP_STEP_STATUS } from '../../lib/setupWizard/constants.js';
import { InvalidSetupTransitionError } from '../../lib/setupWizard/errors.js';

describe('setup run state machine', () => {
  it('allows IN_PROGRESS → READY_FOR_REVIEW', () => {
    expect(canTransitionRun(SETUP_RUN_STATUS.IN_PROGRESS, SETUP_RUN_STATUS.READY_FOR_REVIEW)).toBe(
      true
    );
    expect(() =>
      assertRunTransition(SETUP_RUN_STATUS.IN_PROGRESS, SETUP_RUN_STATUS.READY_FOR_REVIEW)
    ).not.toThrow();
  });

  it('rejects COMPLETED → IN_PROGRESS without reopen path', () => {
    expect(canTransitionRun(SETUP_RUN_STATUS.COMPLETED, SETUP_RUN_STATUS.IN_PROGRESS)).toBe(false);
    expect(() =>
      assertRunTransition(SETUP_RUN_STATUS.COMPLETED, SETUP_RUN_STATUS.IN_PROGRESS)
    ).toThrow(InvalidSetupTransitionError);
  });

  it('allows COMPLETED → REOPEN_REQUESTED only', () => {
    expect(canTransitionRun(SETUP_RUN_STATUS.COMPLETED, SETUP_RUN_STATUS.REOPEN_REQUESTED)).toBe(
      true
    );
  });

  it('allows same-status no-op', () => {
    expect(canTransitionRun(SETUP_RUN_STATUS.IN_PROGRESS, SETUP_RUN_STATUS.IN_PROGRESS)).toBe(true);
  });
});

describe('setup step helpers', () => {
  it('allows NOT_STARTED → IN_PROGRESS, COMPLETED, and SKIPPED_OPTIONAL', () => {
    expect(canTransitionStep(SETUP_STEP_STATUS.NOT_STARTED, SETUP_STEP_STATUS.IN_PROGRESS)).toBe(
      true
    );
    expect(canTransitionStep(SETUP_STEP_STATUS.NOT_STARTED, SETUP_STEP_STATUS.COMPLETED)).toBe(
      true
    );
    expect(
      canTransitionStep(SETUP_STEP_STATUS.NOT_STARTED, SETUP_STEP_STATUS.SKIPPED_OPTIONAL)
    ).toBe(true);
  });

  it('rejects POSTED → IN_PROGRESS', () => {
    expect(canTransitionStep(SETUP_STEP_STATUS.POSTED, SETUP_STEP_STATUS.IN_PROGRESS)).toBe(false);
  });

  it('computes completion percent from step statuses', () => {
    expect(
      computeCompletionPercent([
        { status: SETUP_STEP_STATUS.COMPLETED },
        { status: SETUP_STEP_STATUS.SKIPPED_OPTIONAL },
        { status: SETUP_STEP_STATUS.NOT_STARTED },
        { status: SETUP_STEP_STATUS.IN_PROGRESS },
      ])
    ).toBe(50);
  });
});
