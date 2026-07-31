/**
 * Conversion step helpers — Phase 16 Wave 1–3.
 */

import { createHash } from 'crypto';
import {
  CRM_CONVERSION_STEP_CODE,
  CRM_CONVERSION_STEP_STATUS,
  CRM_CONVERSION_WAVE1_STEPS,
  CRM_CONVERSION_WAVE2_STEPS,
  CRM_CONVERSION_WAVE3_STEPS,
  getConversionDomainContract,
} from './catalogue.js';
import {
  hasCrmConversionAttemptModel,
  hasCrmConversionStepModel,
  serializeConversionStep,
} from './model.js';

const WAVE2_ACTIVE_STEP_CODES = new Set([
  CRM_CONVERSION_STEP_CODE.CREATE_OR_LINK_PLATFORM_CUSTOMER,
  CRM_CONVERSION_STEP_CODE.CREATE_OR_LINK_TENANT,
  CRM_CONVERSION_STEP_CODE.CREATE_BUSINESS,
  CRM_CONVERSION_STEP_CODE.CREATE_BRANCH,
  CRM_CONVERSION_STEP_CODE.LINK_CONTACTS,
  CRM_CONVERSION_STEP_CODE.CREATE_INITIAL_USER_INVITATIONS,
]);

const WAVE3_ACTIVE_STEP_CODES = new Set([
  CRM_CONVERSION_STEP_CODE.CREATE_OR_AMEND_SUBSCRIPTION,
  CRM_CONVERSION_STEP_CODE.PROVISION_ENTITLEMENTS,
  CRM_CONVERSION_STEP_CODE.CREATE_OR_LINK_BILLING_ACCOUNT,
  CRM_CONVERSION_STEP_CODE.CREATE_PLATFORM_INVOICE_IF_REQUIRED,
  CRM_CONVERSION_STEP_CODE.INITIATE_PAYMENT_IF_REQUIRED,
  CRM_CONVERSION_STEP_CODE.ACTIVATE_SUBSCRIPTION,
]);

export function hashConversionInput(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function ensureWave1Steps(prisma, conversionId, inputHash, now = new Date()) {
  if (!hasCrmConversionStepModel(prisma)) {
    return { ok: false, error: 'crm_conversion_step_model_unavailable' };
  }

  const existing = await prisma.crmConversionStep.findMany({
    where: { conversionId },
    orderBy: { stepOrder: 'asc' },
  });
  if (existing.length) {
    return { ok: true, steps: existing.map(serializeConversionStep), alreadyExists: true };
  }

  const rows = [];
  for (const def of CRM_CONVERSION_WAVE1_STEPS) {
    const status =
      def.wave1Default || CRM_CONVERSION_STEP_STATUS.NOT_STARTED;
    const row = await prisma.crmConversionStep.create({
      data: {
        conversionId,
        stepCode: def.stepCode,
        stepOrder: def.stepOrder,
        status,
        inputHash,
        attemptCount: 0,
        outputJson: null,
        errorCode: null,
        retryable: false,
        compensationState: null,
        createdAt: now,
        updatedAt: now,
      },
    });
    rows.push(row);
  }

  return { ok: true, steps: rows.map(serializeConversionStep) };
}

/**
 * Ensure Wave 2 step rows exist and reactivate Wave 1 SKIPPED provision steps.
 */
export async function ensureWave2Steps(prisma, conversionId, inputHash, now = new Date()) {
  if (!hasCrmConversionStepModel(prisma)) {
    return { ok: false, error: 'crm_conversion_step_model_unavailable' };
  }

  const existing = await prisma.crmConversionStep.findMany({
    where: { conversionId },
    orderBy: { stepOrder: 'asc' },
  });
  const byCode = new Map(existing.map((s) => [s.stepCode, s]));

  for (const def of CRM_CONVERSION_WAVE2_STEPS) {
    const current = byCode.get(def.stepCode);
    const defaultStatus =
      def.wave2Default || CRM_CONVERSION_STEP_STATUS.NOT_STARTED;

    if (!current) {
      const row = await prisma.crmConversionStep.create({
        data: {
          conversionId,
          stepCode: def.stepCode,
          stepOrder: def.stepOrder,
          status: defaultStatus,
          inputHash,
          attemptCount: 0,
          outputJson: null,
          errorCode: null,
          retryable: false,
          compensationState: null,
          createdAt: now,
          updatedAt: now,
        },
      });
      byCode.set(def.stepCode, row);
      continue;
    }

    // Reactivate Wave 1 SKIPPED provision steps so Wave 2 can run them.
    if (
      WAVE2_ACTIVE_STEP_CODES.has(def.stepCode) &&
      current.status === CRM_CONVERSION_STEP_STATUS.SKIPPED_NOT_APPLICABLE
    ) {
      const updated = await prisma.crmConversionStep.update({
        where: { id: current.id },
        data: {
          status: CRM_CONVERSION_STEP_STATUS.NOT_STARTED,
          errorCode: null,
          updatedAt: now,
        },
      });
      byCode.set(def.stepCode, updated);
    }
  }

  const steps = [...byCode.values()].sort(
    (a, b) => (a.stepOrder || 0) - (b.stepOrder || 0)
  );
  return { ok: true, steps: steps.map(serializeConversionStep) };
}

/**
 * Ensure Wave 3 step rows exist and reactivate Wave 1/2 SKIPPED subscription steps.
 */
export async function ensureWave3Steps(prisma, conversionId, inputHash, now = new Date()) {
  if (!hasCrmConversionStepModel(prisma)) {
    return { ok: false, error: 'crm_conversion_step_model_unavailable' };
  }

  const existing = await prisma.crmConversionStep.findMany({
    where: { conversionId },
    orderBy: { stepOrder: 'asc' },
  });
  const byCode = new Map(existing.map((s) => [s.stepCode, s]));

  for (const def of CRM_CONVERSION_WAVE3_STEPS) {
    const current = byCode.get(def.stepCode);
    const defaultStatus =
      def.wave3Default || CRM_CONVERSION_STEP_STATUS.NOT_STARTED;

    if (!current) {
      const row = await prisma.crmConversionStep.create({
        data: {
          conversionId,
          stepCode: def.stepCode,
          stepOrder: def.stepOrder,
          status: defaultStatus,
          inputHash,
          attemptCount: 0,
          outputJson: null,
          errorCode: null,
          retryable: false,
          compensationState: null,
          createdAt: now,
          updatedAt: now,
        },
      });
      byCode.set(def.stepCode, row);
      continue;
    }

    if (
      WAVE3_ACTIVE_STEP_CODES.has(def.stepCode) &&
      current.status === CRM_CONVERSION_STEP_STATUS.SKIPPED_NOT_APPLICABLE
    ) {
      const updated = await prisma.crmConversionStep.update({
        where: { id: current.id },
        data: {
          status: CRM_CONVERSION_STEP_STATUS.NOT_STARTED,
          errorCode: null,
          updatedAt: now,
        },
      });
      byCode.set(def.stepCode, updated);
    }
  }

  const steps = [...byCode.values()].sort(
    (a, b) => (a.stepOrder || 0) - (b.stepOrder || 0)
  );
  return { ok: true, steps: steps.map(serializeConversionStep) };
}

export async function recordStepAttempt(prisma, args = {}) {
  if (!hasCrmConversionAttemptModel(prisma)) return null;
  return prisma.crmConversionAttempt.create({
    data: {
      conversionId: args.conversionId,
      stepId: args.stepId,
      stepCode: args.stepCode,
      attemptNumber: args.attemptNumber || 1,
      inputHash: args.inputHash || null,
      status: args.status || null,
      outputJson: args.outputJson ?? null,
      errorCode: args.errorCode || null,
      actorAdminId: args.actorAdminId || null,
      at: args.now || new Date(),
      createdAt: args.now || new Date(),
    },
  });
}

export async function markStepStatus(prisma, stepId, data = {}) {
  return prisma.crmConversionStep.update({
    where: { id: stepId },
    data: {
      ...data,
      updatedAt: data.updatedAt || new Date(),
    },
  });
}

export function isStepCompleted(status) {
  return (
    status === CRM_CONVERSION_STEP_STATUS.COMPLETED ||
    status === CRM_CONVERSION_STEP_STATUS.COMPLETED_WITH_WARNING ||
    status === CRM_CONVERSION_STEP_STATUS.SKIPPED_NOT_APPLICABLE
  );
}

/**
 * Optimistic concurrency claim for a step (CAS on status + attemptCount).
 * Concurrent resume with stale expected values fails visibly — no duplicate work.
 */
export async function claimConversionStep(prisma, args = {}) {
  const stepId = args.stepId ? String(args.stepId).trim() : '';
  if (!stepId) {
    return { ok: false, error: 'stepId_required' };
  }
  if (!hasCrmConversionStepModel(prisma)) {
    return { ok: false, error: 'crm_conversion_step_model_unavailable' };
  }

  const expectedStatus =
    args.expectedStatus != null
      ? args.expectedStatus
      : CRM_CONVERSION_STEP_STATUS.NOT_STARTED;
  const expectedAttemptCount =
    args.expectedAttemptCount != null ? Number(args.expectedAttemptCount) : 0;
  const now = args.now || new Date();
  const nextAttempt = expectedAttemptCount + 1;

  const where = {
    id: stepId,
    status: expectedStatus,
    attemptCount: expectedAttemptCount,
  };
  const data = {
    status: CRM_CONVERSION_STEP_STATUS.IN_PROGRESS,
    attemptCount: nextAttempt,
    updatedAt: now,
  };

  let claimed = false;
  if (typeof prisma.crmConversionStep.updateMany === 'function') {
    const result = await prisma.crmConversionStep.updateMany({ where, data });
    claimed = Boolean(result && result.count > 0);
  } else {
    // Fallback for lean mocks without updateMany — still CAS via read+update.
    let current = null;
    if (typeof prisma.crmConversionStep.findUnique === 'function') {
      current = await prisma.crmConversionStep.findUnique({ where: { id: stepId } });
    } else if (typeof prisma.crmConversionStep.findMany === 'function') {
      const rows = await prisma.crmConversionStep.findMany({});
      current = (rows || []).find((r) => r.id === stepId) || null;
    } else if (typeof prisma.crmConversionStep.findFirst === 'function') {
      current = await prisma.crmConversionStep.findFirst({ where: { id: stepId } });
    }
    if (
      current &&
      current.status === expectedStatus &&
      (current.attemptCount || 0) === expectedAttemptCount
    ) {
      await prisma.crmConversionStep.update({
        where: { id: stepId },
        data,
      });
      claimed = true;
    }
  }

  if (!claimed) {
    return {
      ok: false,
      error: 'step_concurrency_conflict',
      stepId,
      expectedStatus,
      expectedAttemptCount,
    };
  }

  const step =
    typeof prisma.crmConversionStep.findUnique === 'function'
      ? await prisma.crmConversionStep.findUnique({ where: { id: stepId } })
      : typeof prisma.crmConversionStep.findFirst === 'function'
        ? await prisma.crmConversionStep.findFirst({ where: { id: stepId } })
        : {
            id: stepId,
            status: CRM_CONVERSION_STEP_STATUS.IN_PROGRESS,
            attemptCount: nextAttempt,
          };

  return {
    ok: true,
    step: step || {
      id: stepId,
      status: CRM_CONVERSION_STEP_STATUS.IN_PROGRESS,
      attemptCount: nextAttempt,
    },
  };
}

/**
 * Begin a step with optimistic claim. Completed steps skip (resume-safe).
 */
export async function beginStepOptimistic(prisma, args = {}) {
  const step = args.step;
  const now = args.now || new Date();
  if (!step || isStepCompleted(step.status)) {
    return { skip: true, step };
  }
  if (step.status === CRM_CONVERSION_STEP_STATUS.IN_PROGRESS) {
    // Already claimed by another runner — do NOT re-enter create paths (TOCTOU).
    // Caller must wait/re-read resource row or fail closed; never double-create.
    return {
      skip: true,
      step,
      alreadyInProgress: true,
      concurrencyConflict: true,
      error: 'step_already_in_progress',
    };
  }

  const claim = await claimConversionStep(prisma, {
    stepId: step.id,
    expectedStatus: step.status,
    expectedAttemptCount: step.attemptCount || 0,
    now,
  });
  if (!claim.ok) {
    return {
      skip: true,
      step,
      concurrencyConflict: true,
      error: claim.error,
    };
  }
  return { skip: false, step: claim.step };
}

export { CRM_CONVERSION_STEP_STATUS, getConversionDomainContract };
