/**
 * Closed-Won conversion orchestrator — Phase 16 Wave 1–3.
 * Closed Won via Phase 12 closeOpportunityWon ONCE at durable start.
 * Exact retry → existing CVN; conflicting input hash → fail.
 * Resume skips completed validate / closed-won; runs incomplete Closed Won.
 * Wave 2: Customer/Tenant/Business/Branch/invitations after Closed Won.
 * Wave 3: Subscription/entitlements/billing/payment/activation (pending until policy).
 *
 * Early Closed Won is RETAINED on later step failure (no silent reopen).
 */

import { resolveCrmAccess } from '../authz.js';
import { closeOpportunityWon } from '../opportunities/close.js';
import {
  CRM_CONVERSION_REQUEST_STATUS,
  CRM_CONVERSION_STATUS,
  CRM_CONVERSION_STEP_CODE,
  CRM_CONVERSION_STEP_STATUS,
  getConversionDomainContract,
} from './catalogue.js';
import { allocateConversionNumber } from './numbering.js';
import {
  hasCrmConversionFailureModel,
  hasCrmConversionModel,
  hasCrmConversionStepModel,
  resolveConversionActor,
  serializeConversion,
  serializeConversionStep,
} from './model.js';
import { loadConversionRequest } from './requests.js';
import { evaluateConversionRequestReadiness } from './readiness.js';
import { transitionConversionRequestStatus, transitionConversionStatus } from './status.js';
import {
  ensureWave1Steps,
  ensureWave2Steps,
  ensureWave3Steps,
  hashConversionInput,
  isStepCompleted,
  markStepStatus,
  recordStepAttempt,
} from './steps.js';
import { runWave2ProvisionSpine } from './wave2Runner.js';
import { runWave3ProvisionSpine } from './wave3Runner.js';

function canExecuteConversion(access) {
  return Boolean(
    access?.canEditOpportunities ||
      access?.canTransitionOpportunityStages ||
      access?.isSuperAdmin
  );
}

function buildInputPayload(args, request) {
  return {
    conversionRequestId: request.id,
    conversionPlanVersionId: args.conversionPlanVersionId,
    opportunityId: request.opportunityId,
    acceptanceId: request.acceptanceId,
    winReason: args.winReason || 'BEST_FIT',
    decisionDate: args.decisionDate || null,
  };
}

function honestyFlags(extra = {}) {
  return {
    customerCreated: false,
    customerLinked: false,
    tenantCreated: false,
    tenantLinked: false,
    subscriptionCreated: false,
    subscriptionAmended: false,
    subscriptionActive: false,
    invoiceCreated: false,
    invoicePaid: false,
    ...extra,
  };
}

async function loadSteps(prisma, conversionId) {
  return prisma.crmConversionStep.findMany({
    where: { conversionId },
    orderBy: { stepOrder: 'asc' },
  });
}

function findStep(steps, stepCode) {
  return steps.find((s) => s.stepCode === stepCode) || null;
}

function isClosedWonStepComplete(steps) {
  const closedWonStep = findStep(
    steps,
    CRM_CONVERSION_STEP_CODE.TRANSITION_OPPORTUNITY_CLOSED_WON
  );
  return Boolean(closedWonStep && isStepCompleted(closedWonStep.status));
}

/**
 * READY → IN_PROGRESS via transition helper only (no force-bypass).
 */
async function ensureRequestInProgress(prisma, { request, admin, now }) {
  if (!request) return { ok: true, skipped: true };
  if (request.status === CRM_CONVERSION_REQUEST_STATUS.IN_PROGRESS) {
    return { ok: true, alreadyInStatus: true };
  }
  if (request.status !== CRM_CONVERSION_REQUEST_STATUS.READY) {
    // Only READY (or already IN_PROGRESS) is expected at durable start.
    // Other statuses: surface via helper when we attempt; do not force.
    if (
      request.status === CRM_CONVERSION_REQUEST_STATUS.QUEUED
    ) {
      return transitionConversionRequestStatus(prisma, {
        conversionRequestId: request.id,
        toStatus: CRM_CONVERSION_REQUEST_STATUS.IN_PROGRESS,
        admin,
        now,
        reason: 'conversion_started',
      });
    }
    return { ok: true, skipped: true };
  }
  return transitionConversionRequestStatus(prisma, {
    conversionRequestId: request.id,
    toStatus: CRM_CONVERSION_REQUEST_STATUS.IN_PROGRESS,
    admin,
    now,
    reason: 'conversion_started',
  });
}

async function runValidateEvidenceStep(prisma, {
  conversion,
  validateStep,
  admin,
  inputHash,
  readinessStatus,
  now,
}) {
  if (!validateStep || isStepCompleted(validateStep.status)) {
    return { ok: true, skipped: true };
  }

  await markStepStatus(prisma, validateStep.id, {
    status: CRM_CONVERSION_STEP_STATUS.IN_PROGRESS,
    attemptCount: (validateStep.attemptCount || 0) + 1,
    updatedAt: now,
  });
  await recordStepAttempt(prisma, {
    conversionId: conversion.id,
    stepId: validateStep.id,
    stepCode: validateStep.stepCode,
    attemptNumber: (validateStep.attemptCount || 0) + 1,
    inputHash,
    status: CRM_CONVERSION_STEP_STATUS.COMPLETED,
    outputJson: { readinessStatus: readinessStatus || null },
    actorAdminId: admin?.id || null,
    now,
  });
  await markStepStatus(prisma, validateStep.id, {
    status: CRM_CONVERSION_STEP_STATUS.COMPLETED,
    outputJson: { readinessStatus: readinessStatus || null },
    updatedAt: now,
  });
  return { ok: true, skipped: false };
}

/**
 * Phase 12 Closed Won — runs when step incomplete/failed; skips when completed.
 */
async function runClosedWonStep(prisma, {
  conversion,
  closedWonStep,
  request,
  admin,
  args,
  inputHash,
  now,
}) {
  if (!closedWonStep || isStepCompleted(closedWonStep.status)) {
    return { ok: true, skipped: true, closedWonResult: null, conversion };
  }

  await markStepStatus(prisma, closedWonStep.id, {
    status: CRM_CONVERSION_STEP_STATUS.IN_PROGRESS,
    attemptCount: (closedWonStep.attemptCount || 0) + 1,
    updatedAt: now,
  });

  const closedWonResult = await closeOpportunityWon(prisma, {
    admin,
    opportunityId: request.opportunityId || conversion.opportunityId,
    winReason: args.winReason || 'BEST_FIT',
    decisionDate: args.decisionDate || now,
    evidence: args.evidence || [
      {
        type: 'ACCEPTANCE',
        value: request.acceptanceId || conversion.acceptanceId || request.id,
      },
    ],
    idempotencyKey: `cvn-closed-won:${conversion.id}`,
    now,
  });

  if (!closedWonResult.ok && closedWonResult.error !== 'ALREADY_TERMINAL') {
    await markStepStatus(prisma, closedWonStep.id, {
      status: CRM_CONVERSION_STEP_STATUS.FAILED_NON_RETRYABLE,
      errorCode: closedWonResult.error || 'CLOSED_WON_FAILED',
      outputJson: closedWonResult,
      updatedAt: now,
    });
    await prisma.crmConversion.update({
      where: { id: conversion.id },
      data: {
        status: CRM_CONVERSION_STATUS.FAILED,
        updatedAt: now,
      },
    });
    return {
      ok: false,
      skipped: false,
      error: closedWonResult.error || 'closed_won_transition_failed',
      closedWonResult,
      conversion: {
        ...conversion,
        status: CRM_CONVERSION_STATUS.FAILED,
      },
    };
  }

  await recordStepAttempt(prisma, {
    conversionId: conversion.id,
    stepId: closedWonStep.id,
    stepCode: closedWonStep.stepCode,
    attemptNumber: (closedWonStep.attemptCount || 0) + 1,
    inputHash,
    status: CRM_CONVERSION_STEP_STATUS.COMPLETED,
    outputJson: {
      via: 'closeOpportunityWon',
      toStageCode: closedWonResult.toStageCode || 'CLOSED_WON',
      alreadyTerminal: closedWonResult.error === 'ALREADY_TERMINAL',
    },
    actorAdminId: admin?.id || null,
    now,
  });
  await markStepStatus(prisma, closedWonStep.id, {
    status: CRM_CONVERSION_STEP_STATUS.COMPLETED,
    outputJson: {
      via: 'closeOpportunityWon',
      toStageCode: 'CLOSED_WON',
    },
    updatedAt: now,
  });

  const updated = await prisma.crmConversion.update({
    where: { id: conversion.id },
    data: {
      closedWonAt: now,
      closedWonRetained: true,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    skipped: false,
    closedWonResult,
    conversion: updated,
  };
}

async function finalizeConversionStatus(prisma, { conversion, steps, args, now, wave2, wave3 }) {
  if (args.simulateLaterStepFailure) {
    const boundary = findStep(
      steps,
      CRM_CONVERSION_STEP_CODE.WAVE1_PROVISION_BOUNDARY
    );
    if (boundary) {
      await markStepStatus(prisma, boundary.id, {
        status: CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE,
        errorCode: 'WAVE1_SIMULATED_LATER_FAILURE',
        retryable: true,
        outputJson: {
          note: 'Early Closed Won retained; no silent reopen',
          closedWonRetained: true,
        },
        updatedAt: now,
      });
    }
    return prisma.crmConversion.update({
      where: { id: conversion.id },
      data: {
        status: CRM_CONVERSION_STATUS.PARTIALLY_COMPLETED,
        closedWonRetained: true,
        updatedAt: now,
      },
    });
  }

  // Wave 3 activation often deferred (AFTER_PAYMENT) → PARTIALLY_COMPLETED is honest.
  const status = CRM_CONVERSION_STATUS.PARTIALLY_COMPLETED;

  return prisma.crmConversion.update({
    where: { id: conversion.id },
    data: {
      status,
      closedWonRetained: true,
      updatedAt: now,
    },
  });
}

async function loadPlanVersion(prisma, planVersionId) {
  if (!planVersionId || typeof prisma?.crmConversionPlanVersion?.findUnique !== 'function') {
    return null;
  }
  return prisma.crmConversionPlanVersion.findUnique({ where: { id: planVersionId } });
}

/**
 * Validate + Closed Won spine (Wave 1 early steps). Safe to call on resume/retry.
 */
async function runWave1EarlySpine(prisma, {
  conversion: initialConversion,
  request,
  admin,
  args = {},
  inputHash,
  readinessStatus,
  now,
}) {
  let conversion = initialConversion;
  const hash = inputHash || conversion.inputHash || null;

  await ensureWave1Steps(prisma, conversion.id, hash, now);
  let steps = await loadSteps(prisma, conversion.id);

  const validateOutcome = await runValidateEvidenceStep(prisma, {
    conversion,
    validateStep: findStep(steps, CRM_CONVERSION_STEP_CODE.VALIDATE_EVIDENCE),
    admin,
    inputHash: hash,
    readinessStatus,
    now,
  });
  if (!validateOutcome.ok) {
    return {
      ok: false,
      error: validateOutcome.error || 'validate_evidence_failed',
      conversion: serializeConversion(conversion),
      ...honestyFlags(),
      domain: getConversionDomainContract(),
    };
  }

  steps = await loadSteps(prisma, conversion.id);
  const closedWonOutcome = await runClosedWonStep(prisma, {
    conversion,
    closedWonStep: findStep(
      steps,
      CRM_CONVERSION_STEP_CODE.TRANSITION_OPPORTUNITY_CLOSED_WON
    ),
    request,
    admin,
    args,
    inputHash: hash,
    now,
  });

  if (!closedWonOutcome.ok) {
    return {
      ok: false,
      error: closedWonOutcome.error || 'closed_won_transition_failed',
      conversion: serializeConversion(closedWonOutcome.conversion || conversion),
      closedWonResult: closedWonOutcome.closedWonResult,
      ...honestyFlags(),
      domain: getConversionDomainContract(),
    };
  }

  conversion = closedWonOutcome.conversion || conversion;
  steps = await loadSteps(prisma, conversion.id);

  await ensureWave2Steps(prisma, conversion.id, hash, now);
  const planVersion = await loadPlanVersion(
    prisma,
    conversion.conversionPlanVersionId || args.conversionPlanVersionId
  );

  const wave2 = await runWave2ProvisionSpine(prisma, {
    conversion,
    request,
    admin,
    planVersion,
    inputHash: hash,
    now,
    args,
  });

  let wave3 = {
    ok: true,
    blocked: false,
    subscriptionCreated: false,
    subscriptionAmended: false,
    subscriptionActive: false,
    invoiceCreated: false,
    invoicePaid: false,
  };

  // Wave 3 only when Wave 2 did not hard-block Customer/Tenant provision.
  if (!wave2.blocked && wave2.ok !== false) {
    await ensureWave3Steps(prisma, conversion.id, hash, now);
    wave3 = await runWave3ProvisionSpine(prisma, {
      conversion,
      request,
      admin,
      planVersion,
      inputHash: hash,
      now,
      args,
      tenantId: wave2.tenantId || null,
      customerId: wave2.customerId || null,
    });
  }

  steps = wave3.steps || wave2.steps || (await loadSteps(prisma, conversion.id));
  conversion = await finalizeConversionStatus(prisma, {
    conversion,
    steps,
    args,
    now,
    wave2,
    wave3,
  });
  const finalSteps = await loadSteps(prisma, conversion.id);

  // Closed Won is retained even when Wave 2/3 blocks/partial-fails.
  const spineError =
    wave2.ok === false
      ? wave2.error || null
      : wave3.ok === false
        ? wave3.error || null
        : null;

  return {
    ok: true,
    error: spineError,
    blocked: Boolean(wave2.blocked || wave3.blocked),
    conversion,
    steps: finalSteps,
    closedWonResult: closedWonOutcome.closedWonResult,
    closedWonRan: !closedWonOutcome.skipped,
    validateRan: !validateOutcome.skipped,
    customerId: wave2.customerId || wave3.customerId || null,
    tenantId: wave2.tenantId || wave3.tenantId || null,
    customerCreated: Boolean(wave2.customerCreated),
    customerLinked: Boolean(wave2.customerLinked),
    tenantCreated: Boolean(wave2.tenantCreated),
    tenantLinked: Boolean(wave2.tenantLinked),
    invitationsCreated: wave2.invitationsCreated || 0,
    subscriptionId: wave3.subscriptionId || null,
    subscriptionCreated: Boolean(wave3.subscriptionCreated),
    subscriptionAmended: Boolean(wave3.subscriptionAmended),
    subscriptionActive: Boolean(wave3.subscriptionActive),
    invoiceCreated: Boolean(wave3.invoiceCreated),
    invoicePaid: Boolean(wave3.invoicePaid),
  };
}

/**
 * Exact-retry / race replay: never report success while Closed Won incomplete.
 */
async function continueOrReplayExistingConversion(prisma, {
  existing,
  request,
  admin,
  args,
  inputHash,
  now,
}) {
  let conversion = existing;

  if (conversion.status === CRM_CONVERSION_STATUS.LOCKED) {
    const tr = await transitionConversionStatus(prisma, {
      conversionId: conversion.id,
      toStatus: CRM_CONVERSION_STATUS.IN_PROGRESS,
      admin,
      now,
      reason: 'durable_execution_resume',
    });
    if (tr.ok && tr.conversion) {
      conversion = {
        ...conversion,
        status: CRM_CONVERSION_STATUS.IN_PROGRESS,
      };
    }
  }

  const reqTransition = await ensureRequestInProgress(prisma, {
    request,
    admin,
    now,
  });
  if (!reqTransition.ok) {
    return {
      ok: false,
      error: reqTransition.error || 'conversion_request_status_transition_failed',
      conversion: serializeConversion(conversion),
      ...honestyFlags(),
      domain: getConversionDomainContract(),
    };
  }

  await ensureWave1Steps(prisma, conversion.id, inputHash || conversion.inputHash, now);
  const steps = await loadSteps(prisma, conversion.id);

  // Incomplete Closed Won: finish early spine (includes Wave 2 after CW).
  // Completed Closed Won: still run Wave 2 for incomplete provision steps.
  let readinessStatus = null;
  const readiness = await evaluateConversionRequestReadiness(prisma, {
    conversionRequestId: request.id,
    admin,
    actorContext: args.actorContext,
  });
  if (readiness.ok) {
    readinessStatus = readiness.readinessStatus;
  }

  const spine = await runWave1EarlySpine(prisma, {
    conversion,
    request,
    admin,
    args,
    inputHash: inputHash || conversion.inputHash,
    readinessStatus,
    now,
  });

  if (!spine.ok) {
    return spine;
  }

  return {
    ok: true,
    conversion: serializeConversion(spine.conversion),
    steps: spine.steps.map(serializeConversionStep),
    alreadyExists: true,
    idempotentReplay: true,
    resumedIncompleteClosedWon: spine.closedWonRan,
    closedWonVia: 'closeOpportunityWon',
    closedWonResult: spine.closedWonResult
      ? {
          ok: spine.closedWonResult.ok,
          toStageCode: spine.closedWonResult.toStageCode || 'CLOSED_WON',
        }
      : null,
    ...honestyFlags({
      customerCreated: spine.customerCreated,
      customerLinked: spine.customerLinked,
      tenantCreated: spine.tenantCreated,
      tenantLinked: spine.tenantLinked,
      subscriptionCreated: spine.subscriptionCreated,
      subscriptionAmended: spine.subscriptionAmended,
      subscriptionActive: spine.subscriptionActive,
      invoiceCreated: spine.invoiceCreated,
      invoicePaid: spine.invoicePaid,
    }),
    customerId: spine.customerId || null,
    tenantId: spine.tenantId || null,
    subscriptionId: spine.subscriptionId || null,
    blocked: spine.blocked,
    domain: getConversionDomainContract(),
  };
}

/**
 * Execute Closed-Won conversion (Wave 1–3 spine).
 */
export async function executeClosedWonConversion(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const access = resolveCrmAccess(admin);
  if (!canExecuteConversion(access)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_conversion_execute_forbidden',
    };
  }
  if (!hasCrmConversionModel(prisma) || !hasCrmConversionStepModel(prisma)) {
    return {
      ok: false,
      error: 'crm_conversion_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (!idempotencyKey) {
    return { ok: false, error: 'idempotencyKey_required' };
  }

  const planVersionId = args.conversionPlanVersionId
    ? String(args.conversionPlanVersionId).trim()
    : '';
  if (!planVersionId) {
    return { ok: false, error: 'conversionPlanVersionId_required' };
  }

  const request = await loadConversionRequest(prisma, args.conversionRequestId);
  if (!request) {
    return { ok: false, notFound: true, error: 'conversion_request_not_found' };
  }

  const inputPayload = buildInputPayload(args, request);
  const inputHash = hashConversionInput(inputPayload);
  const now = args.now || new Date();

  // Exact / conflicting retry
  const existing = await prisma.crmConversion.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    if (existing.inputHash && existing.inputHash !== inputHash) {
      if (hasCrmConversionFailureModel(prisma)) {
        await prisma.crmConversionFailure.create({
          data: {
            conversionId: existing.id,
            conversionRequestId: request.id,
            errorCode: 'IDEMPOTENCY_INPUT_CONFLICT',
            detailJson: {
              existingInputHash: existing.inputHash,
              attemptedInputHash: inputHash,
              idempotencyKey,
            },
            createdAt: now,
          },
        });
      }
      return {
        ok: false,
        error: 'idempotency_input_conflict',
        existingConversionId: existing.id,
        existingInputHash: existing.inputHash,
        attemptedInputHash: inputHash,
        domain: getConversionDomainContract(),
      };
    }
    return continueOrReplayExistingConversion(prisma, {
      existing,
      request,
      admin,
      args,
      inputHash,
      now,
    });
  }

  const readiness = await evaluateConversionRequestReadiness(prisma, {
    conversionRequestId: request.id,
    admin,
    actorContext: args.actorContext,
  });
  if (!readiness.ok) {
    return {
      ok: false,
      error: 'conversion_not_ready',
      readiness,
      domain: getConversionDomainContract(),
    };
  }

  const planVersion = await prisma.crmConversionPlanVersion.findUnique({
    where: { id: planVersionId },
  });
  if (!planVersion) {
    return { ok: false, notFound: true, error: 'conversion_plan_version_not_found' };
  }

  const allocated = await allocateConversionNumber(prisma, { now });
  if (!allocated.ok) {
    return {
      ok: false,
      error: allocated.error || 'conversion_number_allocation_failed',
    };
  }

  // Lock durable conversion
  let conversion;
  try {
    conversion = await prisma.crmConversion.create({
      data: {
        conversionNumber: allocated.number,
        status: CRM_CONVERSION_STATUS.LOCKED,
        conversionRequestId: request.id,
        conversionPlanVersionId: planVersionId,
        opportunityId: request.opportunityId,
        acceptanceId: request.acceptanceId,
        inputHash,
        idempotencyKey,
        closedWonAt: null,
        closedWonRetained: true,
        createdByAdminId: admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    const raced = await prisma.crmConversion.findUnique({
      where: { idempotencyKey },
    });
    if (raced) {
      if (raced.inputHash && raced.inputHash !== inputHash) {
        return {
          ok: false,
          error: 'idempotency_input_conflict',
          existingConversionId: raced.id,
          domain: getConversionDomainContract(),
        };
      }
      return continueOrReplayExistingConversion(prisma, {
        existing: raced,
        request,
        admin,
        args,
        inputHash,
        now,
      });
    }
    return { ok: false, error: err?.message || 'conversion_create_failed' };
  }

  await transitionConversionStatus(prisma, {
    conversionId: conversion.id,
    toStatus: CRM_CONVERSION_STATUS.IN_PROGRESS,
    admin,
    now,
    reason: 'durable_execution_start',
  });

  const reqTransition = await ensureRequestInProgress(prisma, {
    request,
    admin,
    now,
  });
  if (!reqTransition.ok) {
    return {
      ok: false,
      error: reqTransition.error || 'conversion_request_status_transition_failed',
      conversion: serializeConversion(conversion),
      ...honestyFlags(),
      domain: getConversionDomainContract(),
    };
  }

  const spine = await runWave1EarlySpine(prisma, {
    conversion,
    request,
    admin,
    args,
    inputHash,
    readinessStatus: readiness.readinessStatus,
    now,
  });

  if (!spine.ok) {
    return spine;
  }

  return {
    ok: true,
    conversion: serializeConversion(spine.conversion),
    steps: spine.steps.map(serializeConversionStep),
    closedWonVia: 'closeOpportunityWon',
    closedWonResult: spine.closedWonResult
      ? {
          ok: spine.closedWonResult.ok,
          toStageCode: spine.closedWonResult.toStageCode || 'CLOSED_WON',
        }
      : null,
    ...honestyFlags({
      customerCreated: spine.customerCreated,
      customerLinked: spine.customerLinked,
      tenantCreated: spine.tenantCreated,
      tenantLinked: spine.tenantLinked,
      subscriptionCreated: spine.subscriptionCreated,
      subscriptionAmended: spine.subscriptionAmended,
      subscriptionActive: spine.subscriptionActive,
      invoiceCreated: spine.invoiceCreated,
      invoicePaid: spine.invoicePaid,
    }),
    customerId: spine.customerId || null,
    tenantId: spine.tenantId || null,
    subscriptionId: spine.subscriptionId || null,
    invitationsCreated: spine.invitationsCreated || 0,
    blocked: spine.blocked,
    domain: getConversionDomainContract(),
  };
}

/**
 * Resume conversion — skip completed validate / closed-won; run incomplete Closed Won + Wave 2/3.
 * Never invents a second CVN.
 */
export async function resumeConversion(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const access = resolveCrmAccess(admin);
  if (!canExecuteConversion(access)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_conversion_resume_forbidden',
    };
  }

  const conversionId = args.conversionId ? String(args.conversionId).trim() : '';
  if (!conversionId) return { ok: false, error: 'conversionId_required' };

  let conversion = await prisma.crmConversion.findUnique({
    where: { id: conversionId },
  });
  if (!conversion) {
    return { ok: false, notFound: true, error: 'conversion_not_found' };
  }

  // Idempotency key must match when provided
  if (
    args.idempotencyKey &&
    conversion.idempotencyKey &&
    String(args.idempotencyKey).trim() !== conversion.idempotencyKey
  ) {
    return {
      ok: false,
      error: 'idempotency_key_mismatch',
      domain: getConversionDomainContract(),
    };
  }

  const now = args.now || new Date();
  const request =
    (await loadConversionRequest(prisma, conversion.conversionRequestId)) || {
      id: conversion.conversionRequestId,
      opportunityId: conversion.opportunityId,
      acceptanceId: conversion.acceptanceId,
      status: null,
    };

  await ensureWave1Steps(
    prisma,
    conversion.id,
    conversion.inputHash,
    now
  );
  await ensureWave2Steps(prisma, conversion.id, conversion.inputHash, now);
  await ensureWave3Steps(prisma, conversion.id, conversion.inputHash, now);
  let steps = await loadSteps(prisma, conversion.id);

  const skippedStepCodes = [];
  for (const step of steps) {
    if (
      (step.stepCode === CRM_CONVERSION_STEP_CODE.VALIDATE_EVIDENCE ||
        step.stepCode ===
          CRM_CONVERSION_STEP_CODE.TRANSITION_OPPORTUNITY_CLOSED_WON) &&
      isStepCompleted(step.status)
    ) {
      skippedStepCodes.push(step.stepCode);
    }
  }

  let readinessStatus = null;
  if (request.id) {
    const readiness = await evaluateConversionRequestReadiness(prisma, {
      conversionRequestId: request.id,
      admin,
      actorContext: args.actorContext,
    });
    if (readiness.ok) readinessStatus = readiness.readinessStatus;
  }

  const spine = await runWave1EarlySpine(prisma, {
    conversion,
    request,
    admin,
    args,
    inputHash: conversion.inputHash,
    readinessStatus,
    now,
  });
  if (!spine.ok) {
    return spine;
  }
  conversion = spine.conversion;
  steps = spine.steps;

  // Retry failed boundary if present — Wave 2 provision handled above
  const boundary = steps.find(
    (s) =>
      s.stepCode === CRM_CONVERSION_STEP_CODE.WAVE1_PROVISION_BOUNDARY &&
      s.status === CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE
  );
  if (boundary) {
    await markStepStatus(prisma, boundary.id, {
      status: CRM_CONVERSION_STEP_STATUS.SKIPPED_NOT_APPLICABLE,
      errorCode: null,
      outputJson: {
        resumed: true,
        wave2: true,
        note: 'Wave 3 subscription/billing/activation executed or deferred by policy; Closed Won retained',
      },
      updatedAt: now,
    });
  }

  const updated = await prisma.crmConversion.update({
    where: { id: conversion.id },
    data: {
      status: CRM_CONVERSION_STATUS.PARTIALLY_COMPLETED,
      closedWonRetained: true,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    conversion: serializeConversion(updated),
    skippedStepCodes,
    closedWonRetained: true,
    closedWonCompletedOnResume: isClosedWonStepComplete(
      await loadSteps(prisma, conversion.id)
    ),
    ...honestyFlags({
      customerCreated: spine.customerCreated,
      customerLinked: spine.customerLinked,
      tenantCreated: spine.tenantCreated,
      tenantLinked: spine.tenantLinked,
      subscriptionCreated: spine.subscriptionCreated,
      subscriptionAmended: spine.subscriptionAmended,
      subscriptionActive: spine.subscriptionActive,
      invoiceCreated: spine.invoiceCreated,
      invoicePaid: spine.invoicePaid,
    }),
    domain: getConversionDomainContract(),
  };
}
