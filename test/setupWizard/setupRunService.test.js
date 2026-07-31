import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SETUP_STEP_STATUS, SETUP_TYPE } from '../../lib/setupWizard/constants.js';
import { BusinessSetupVersionConflictError } from '../../lib/setupWizard/errors.js';

vi.mock('../../lib/setupWizard/activityClassifier.js', () => ({
  classifyBusinessActivity: vi.fn(async () => ({
    classification: 'NEW_EMPTY_BUSINESS',
    reason: 'empty',
    counts: {},
  })),
  assertSetupStartAllowed: vi.fn((r) => r),
}));

import {
  createSetupRun,
  saveSetupStep,
  getSetupProgress,
} from '../../lib/setupWizard/setupRunService.js';

describe('setupRunService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createSetupRun seeds 23 steps and returns progress', async () => {
    const created = {
      id: 'run1',
      tenantId: 't1',
      setupVersion: 1,
      setupType: SETUP_TYPE.NEW_BUSINESS,
      status: 'IN_PROGRESS',
      currentStepId: 'profile',
      draftVersion: 1,
      completionPercent: 0,
      openingBalanceDate: null,
      cutoverDate: null,
      activityClassification: 'NEW_EMPTY_BUSINESS',
      steps: Array.from({ length: 23 }, (_, i) => ({
        id: `s${i}`,
        stepId: ['profile', 'ownership', 'calendar'][i] || `step${i}`,
        status: SETUP_STEP_STATUS.NOT_STARTED,
        sortOrder: i,
        optional: false,
        payload: {},
        warningCount: 0,
      })),
    };

    const db = {
      businessSetupRun: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null) // active
          .mockResolvedValueOnce(null), // latest version
        create: vi.fn(async () => created),
      },
    };

    const run = await createSetupRun(
      { tenantId: 't1', userId: 'u1', setupType: SETUP_TYPE.NEW_BUSINESS },
      db
    );

    expect(db.businessSetupRun.create).toHaveBeenCalled();
    expect(run.steps).toHaveLength(23);
    expect(run.progress.completionPercent).toBe(0);
  });

  it('saveSetupStep rejects draft version conflict', async () => {
    const db = {
      businessSetupRun: {
        findFirst: vi.fn(async () => ({
          id: 'run1',
          tenantId: 't1',
          setupVersion: 1,
          draftVersion: 5,
          steps: [
            {
              id: 'st1',
              stepId: 'profile',
              status: SETUP_STEP_STATUS.NOT_STARTED,
              payload: {},
            },
          ],
        })),
      },
    };

    await expect(
      saveSetupStep(
        {
          runId: 'run1',
          tenantId: 't1',
          userId: 'u1',
          stepId: 'profile',
          payload: { legalName: 'Acme' },
          expectedDraftVersion: 4,
        },
        db
      )
    ).rejects.toBeInstanceOf(BusinessSetupVersionConflictError);
  });

  it('getSetupProgress reports completed and blocked ids', () => {
    const progress = getSetupProgress({
      id: 'run1',
      setupVersion: 1,
      status: 'IN_PROGRESS',
      currentStepId: 'calendar',
      draftVersion: 2,
      openingBalanceDate: null,
      cutoverDate: null,
      activityClassification: 'NEW_EMPTY_BUSINESS',
      steps: [
        { stepId: 'profile', status: SETUP_STEP_STATUS.COMPLETED, warningCount: 0 },
        { stepId: 'ownership', status: SETUP_STEP_STATUS.BLOCKED, warningCount: 0 },
        { stepId: 'calendar', status: SETUP_STEP_STATUS.IN_PROGRESS, warningCount: 0 },
      ],
    });
    expect(progress.completedStepIds).toEqual(['profile']);
    expect(progress.blockedStepIds).toEqual(['ownership']);
    expect(progress.completionPercent).toBe(33);
  });
});
