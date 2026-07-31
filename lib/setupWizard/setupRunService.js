/**
 * Business Setup Run service — create, resume, save steps, progress.
 */

import prisma from '../prisma.js';
import {
  SETUP_RUN_STATUS,
  SETUP_STEP_DEFS,
  SETUP_STEP_STATUS,
  SETUP_TYPE,
} from './constants.js';
import {
  classifyBusinessActivity,
  assertSetupStartAllowed,
} from './activityClassifier.js';
import { assertStepTransition, computeCompletionPercent } from './stateMachine.js';
import {
  BusinessSetupNotFoundError,
  BusinessSetupVersionConflictError,
  CrossBusinessSetupDataError,
} from './errors.js';
import {
  applyProfileToBusiness,
  ensureCoaForSetup,
  resolveSetupSystemMappings,
} from './foundationService.js';

const ACTIVE_STATUSES = [
  SETUP_RUN_STATUS.NOT_STARTED,
  SETUP_RUN_STATUS.IN_PROGRESS,
  SETUP_RUN_STATUS.WAITING_FOR_INFORMATION,
  SETUP_RUN_STATUS.READY_FOR_REVIEW,
  SETUP_RUN_STATUS.UNDER_REVIEW,
  SETUP_RUN_STATUS.CHANGES_REQUIRED,
  SETUP_RUN_STATUS.APPROVED,
  SETUP_RUN_STATUS.POSTING,
  SETUP_RUN_STATUS.POSTING_FAILED,
  SETUP_RUN_STATUS.REOPENED,
];

function seedSteps(tenantId) {
  return SETUP_STEP_DEFS.map((def, index) => ({
    tenantId,
    stepId: def.id,
    status: SETUP_STEP_STATUS.NOT_STARTED,
    sortOrder: index,
    optional: Boolean(def.optional),
    payload: {},
  }));
}

/**
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @param {string} [params.setupType]
 * @param {boolean} [params.conversionApproved]
 * @param {string} [params.baseCurrency]
 * @param {string} [params.timezone]
 */
export async function createSetupRun(params, db = prisma) {
  const {
    tenantId,
    userId,
    setupType = SETUP_TYPE.NEW_BUSINESS,
    conversionApproved = false,
    baseCurrency = null,
    timezone = null,
  } = params;

  const classification = await classifyBusinessActivity(tenantId, db);
  assertSetupStartAllowed(classification, { setupType, conversionApproved });

  const existingActive = await db.businessSetupRun.findFirst({
    where: { tenantId, status: { in: ACTIVE_STATUSES } },
    orderBy: { setupVersion: 'desc' },
  });
  if (existingActive) {
    return getSetupRun(existingActive.id, tenantId, db);
  }

  const latest = await db.businessSetupRun.findFirst({
    where: { tenantId },
    orderBy: { setupVersion: 'desc' },
    select: { setupVersion: true },
  });
  const setupVersion = (latest?.setupVersion ?? 0) + 1;

  const run = await db.businessSetupRun.create({
    data: {
      tenantId,
      setupVersion,
      setupType,
      status: SETUP_RUN_STATUS.IN_PROGRESS,
      currentStepId: 'profile',
      baseCurrency,
      timezone,
      activityClassification: classification.classification,
      conversionApprovedAt: conversionApproved ? new Date() : null,
      conversionApprovedBy: conversionApproved ? userId : null,
      createdById: userId,
      lastUpdatedById: userId,
      steps: { create: seedSteps(tenantId) },
      metadata: {
        classificationReason: classification.reason,
        classificationCounts: classification.counts,
      },
    },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });

  return decorateRun(run);
}

/**
 * @param {string} tenantId
 */
export async function getActiveSetupRun(tenantId, db = prisma) {
  const run = await db.businessSetupRun.findFirst({
    where: { tenantId, status: { in: ACTIVE_STATUSES } },
    orderBy: { setupVersion: 'desc' },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });
  return run ? decorateRun(run) : null;
}

/**
 * @param {string} runId
 * @param {string} tenantId
 */
export async function getSetupRun(runId, tenantId, db = prisma) {
  const run = await db.businessSetupRun.findFirst({
    where: { id: runId },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!run) {
    throw new BusinessSetupNotFoundError({ setupRunId: runId });
  }
  if (run.tenantId !== tenantId) {
    throw new CrossBusinessSetupDataError({ setupRunId: runId });
  }
  return decorateRun(run);
}

/**
 * @param {object} params
 */
export async function saveSetupStep(params, db = prisma) {
  const {
    runId,
    tenantId,
    userId,
    stepId,
    payload = {},
    status,
    expectedDraftVersion,
    currentStepId,
    openingBalanceDate,
    cutoverDate,
    baseCurrency,
    timezone,
  } = params;

  const run = await db.businessSetupRun.findFirst({
    where: { id: runId },
    include: { steps: true },
  });
  if (!run) {
    throw new BusinessSetupNotFoundError({ setupRunId: runId });
  }
  if (run.tenantId !== tenantId) {
    throw new CrossBusinessSetupDataError({ setupRunId: runId });
  }

  if (
    expectedDraftVersion != null &&
    Number(expectedDraftVersion) !== Number(run.draftVersion)
  ) {
    throw new BusinessSetupVersionConflictError({
      setupRunId: runId,
      setupVersion: run.setupVersion,
      stepId,
      diagnostic: {
        expected: expectedDraftVersion,
        actual: run.draftVersion,
      },
    });
  }

  const step = run.steps.find((s) => s.stepId === stepId);
  if (!step) {
    throw new BusinessSetupNotFoundError({
      setupRunId: runId,
      stepId,
      diagnostic: { message: 'unknown step' },
    });
  }

  const nextStatus = status || SETUP_STEP_STATUS.IN_PROGRESS;
  assertStepTransition(step.status, nextStatus, { setupRunId: runId, stepId });

  const mergedPayload = {
    ...(step.payload && typeof step.payload === 'object' ? step.payload : {}),
    ...payload,
  };

  // Domain-specific run fields from early steps
  const runPatch = {
    draftVersion: { increment: 1 },
    lastUpdatedById: userId,
  };
  if (currentStepId) runPatch.currentStepId = currentStepId;
  else runPatch.currentStepId = stepId;

  if (stepId === 'calendar' || openingBalanceDate !== undefined || cutoverDate !== undefined) {
    if (openingBalanceDate !== undefined || payload.openingBalanceDate) {
      const raw = openingBalanceDate ?? payload.openingBalanceDate;
      runPatch.openingBalanceDate = raw ? new Date(String(raw).slice(0, 10)) : null;
    }
    if (cutoverDate !== undefined || payload.cutoverDate) {
      const raw = cutoverDate ?? payload.cutoverDate;
      runPatch.cutoverDate = raw ? new Date(String(raw).slice(0, 10)) : null;
    }
  }
  if (baseCurrency || payload.baseCurrency) {
    runPatch.baseCurrency = baseCurrency || payload.baseCurrency;
  }
  if (timezone || payload.timezone) {
    runPatch.timezone = timezone || payload.timezone;
  }

  // Material edits after approval invalidate approval
  if (
    [SETUP_RUN_STATUS.APPROVED, SETUP_RUN_STATUS.READY_FOR_REVIEW].includes(run.status) &&
    [
      'calendar',
      'paymentAccounts',
      'openingReceivables',
      'openingPayables',
      'openingStock',
      'fixedAssets',
      'otherAssets',
      'liabilitiesLoans',
      'taxes',
      'capitalEquity',
      'manualBalances',
      'accountMappings',
    ].includes(stepId)
  ) {
    runPatch.status = SETUP_RUN_STATUS.IN_PROGRESS;
    runPatch.sourceChecksum = null;
    runPatch.approvedAt = null;
    runPatch.approvedById = null;
  }

  let finalPayload = mergedPayload;
  if (stepId === 'profile') {
    await applyProfileToBusiness(tenantId, mergedPayload, db);
  }
  if (stepId === 'chartOfAccounts') {
    const coa = await ensureCoaForSetup(tenantId, db);
    finalPayload = { ...mergedPayload, accountCount: coa.accountCount, sample: coa.sample };
  }
  if (stepId === 'accountMappings') {
    const resolved = await resolveSetupSystemMappings(
      tenantId,
      mergedPayload.mappings || {},
      db
    );
    finalPayload = {
      ...mergedPayload,
      mappings: resolved.mappings,
      mappingIssues: resolved.issues,
    };
  }

  await db.$transaction(async (tx) => {
    await tx.businessSetupStep.update({
      where: { id: step.id },
      data: {
        status: nextStatus,
        payload: finalPayload,
        lastSavedAt: new Date(),
        lastSavedById: userId,
      },
    });
    await tx.businessSetupRun.update({
      where: { id: runId },
      data: runPatch,
    });
  });

  const refreshed = await getSetupRun(runId, tenantId, db);
  const percent = computeCompletionPercent(refreshed.steps);
  if (percent !== refreshed.completionPercent) {
    await db.businessSetupRun.update({
      where: { id: runId },
      data: { completionPercent: percent },
    });
    refreshed.completionPercent = percent;
  }
  return refreshed;
}

/**
 * @param {object} run
 */
export function getSetupProgress(run) {
  const steps = run.steps || [];
  const percent = computeCompletionPercent(steps);
  const completed = steps.filter((s) =>
    [
      SETUP_STEP_STATUS.COMPLETED,
      SETUP_STEP_STATUS.COMPLETED_WITH_WARNINGS,
      SETUP_STEP_STATUS.SKIPPED_OPTIONAL,
      SETUP_STEP_STATUS.APPROVED,
      SETUP_STEP_STATUS.POSTED,
    ].includes(s.status)
  );
  const blocked = steps.filter((s) => s.status === SETUP_STEP_STATUS.BLOCKED);
  const warnings = steps.filter(
    (s) => s.status === SETUP_STEP_STATUS.COMPLETED_WITH_WARNINGS || s.warningCount > 0
  );

  return {
    setupRunId: run.id,
    setupVersion: run.setupVersion,
    status: run.status,
    currentStepId: run.currentStepId,
    completionPercent: percent,
    draftVersion: run.draftVersion,
    completedStepIds: completed.map((s) => s.stepId),
    blockedStepIds: blocked.map((s) => s.stepId),
    warningStepIds: warnings.map((s) => s.stepId),
    openingBalanceDate: run.openingBalanceDate,
    cutoverDate: run.cutoverDate,
    activityClassification: run.activityClassification,
  };
}

function decorateRun(run) {
  const percent = computeCompletionPercent(run.steps || []);
  return {
    ...run,
    completionPercent: percent,
    progress: getSetupProgress({ ...run, completionPercent: percent }),
    stepDefs: SETUP_STEP_DEFS,
  };
}
