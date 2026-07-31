/**
 * Customer Training Programs (TRN-YYYY-######) — Phase 18 Wave 1.
 * Requires pinned ACTIVE curriculumVersionId. No Sessions / attendance.
 */

import { createHash } from 'crypto';
import {
  TRAINING_PROGRAM_STATUS,
  TRAINING_REQUEST_STATUS,
  TRAINING_TYPE,
  getTrainingDomainContract,
} from './catalogue.js';
import { allocateTrainingProgramNumber } from './numbering.js';
import {
  canManageTraining,
  canViewTraining,
  hasCustomerTrainingProgramModel,
  hasCustomerTrainingCurriculumVersionModel,
  resolveTrainingActor,
  serializeTrainingProgram,
} from './model.js';
import { requestMissingPins } from './requests.js';
import { transitionTrainingRequestStatus } from './status.js';
import {
  resolveTrainingListScope,
  tenantWhereFromScope,
} from './listScope.js';
import { assertTrainingTenantInPortfolioScope } from './programAccess.js';

/** Terminal / non-active Program statuses — do not block a new Program purpose. */
const ACTIVE_PROGRAM_EXCLUSIONS = Object.freeze([
  TRAINING_PROGRAM_STATUS.COMPLETED,
  TRAINING_PROGRAM_STATUS.COMPLETED_WITH_GAPS,
  TRAINING_PROGRAM_STATUS.CANCELLED,
  TRAINING_PROGRAM_STATUS.FAILED,
  TRAINING_PROGRAM_STATUS.ARCHIVED,
]);

function hashProgramInput(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * One active Program purpose per customer + tenant + trainingType.
 */
export async function findActiveProgramForPurpose(prisma, args = {}) {
  const { customerId, tenantId, trainingType, excludeProgramId } = args;
  if (!customerId || !tenantId || !trainingType) return null;
  if (typeof prisma.customerTrainingProgram.findFirst !== 'function') return null;

  const where = {
    customerId: String(customerId),
    tenantId: String(tenantId),
    trainingType: String(trainingType),
    status: { notIn: [...ACTIVE_PROGRAM_EXCLUSIONS] },
  };
  if (excludeProgramId) {
    where.id = { not: String(excludeProgramId) };
  }
  return prisma.customerTrainingProgram.findFirst({ where });
}

function resolveOwnerPins(ownerAssignments = {}, admin = null) {
  const assignments =
    ownerAssignments && typeof ownerAssignments === 'object' ? ownerAssignments : {};
  const csOwnerAdminId =
    (assignments.csOwnerAdminId && String(assignments.csOwnerAdminId)) ||
    (assignments.csOwnerId && String(assignments.csOwnerId)) ||
    (admin?.id ? String(admin.id) : null);
  const ownerAdminId =
    (assignments.ownerAdminId && String(assignments.ownerAdminId)) ||
    (assignments.leadTrainerAdminId && String(assignments.leadTrainerAdminId)) ||
    csOwnerAdminId ||
    (admin?.id ? String(admin.id) : null);
  return { csOwnerAdminId, ownerAdminId };
}

/**
 * Repair Request → CONVERTED_TO_PROGRAM when Program already exists.
 * Never fabricates trainingCompleted.
 */
async function ensureRequestConvertedToProgram(prisma, args = {}) {
  const { admin, request, program, now, actorContext } = args;
  if (!request || !program) return;
  if (request.status === TRAINING_REQUEST_STATUS.CONVERTED_TO_PROGRAM) {
    if (!request.programId && program.id) {
      await prisma.customerTrainingRequest.update({
        where: { id: request.id },
        data: { programId: program.id, updatedAt: now || new Date() },
      });
    }
    return;
  }
  if (request.status !== TRAINING_REQUEST_STATUS.ACCEPTED) return;

  await transitionTrainingRequestStatus(prisma, {
    admin,
    actorContext,
    trainingRequestId: request.id,
    toStatus: TRAINING_REQUEST_STATUS.CONVERTED_TO_PROGRAM,
    programId: program.id,
    reason: 'converted_to_program',
    now: now || new Date(),
  });
}

/**
 * Create Training Program from accepted Request. One Request → at most one Program.
 */
export async function createCustomerTrainingProgram(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'training_program_create_forbidden',
    };
  }
  if (!hasCustomerTrainingProgramModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_program_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const trainingRequestId = args.trainingRequestId
    ? String(args.trainingRequestId).trim()
    : '';
  if (!trainingRequestId) {
    return { ok: false, error: 'training_request_id_required' };
  }

  const curriculumVersionId = args.curriculumVersionId;
  if (!curriculumVersionId) {
    return { ok: false, error: 'curriculum_version_id_required' };
  }

  if (hasCustomerTrainingCurriculumVersionModel(prisma)) {
    const curr = await prisma.customerTrainingCurriculumVersion.findUnique({
      where: { id: String(curriculumVersionId) },
    });
    if (!curr) {
      return { ok: false, error: 'curriculum_version_not_found' };
    }
    if (String(curr.status).toUpperCase() !== 'ACTIVE') {
      return { ok: false, error: 'curriculum_version_not_active' };
    }
  }

  const request = await prisma.customerTrainingRequest.findUnique({
    where: { id: trainingRequestId },
  });
  if (!request) {
    return { ok: false, notFound: true, error: 'training_request_not_found' };
  }

  const scopeGate = await assertTrainingTenantInPortfolioScope(
    prisma,
    admin,
    request.tenantId,
    args
  );
  if (!scopeGate.ok) return scopeGate;

  const missing = requestMissingPins(request);
  if (missing.length) {
    return {
      ok: false,
      error: `missing_required_pins: ${missing.join(',')}`,
      missing,
    };
  }

  const now = args.now || new Date();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (!idempotencyKey) {
    return { ok: false, error: 'idempotency_key_required' };
  }

  const ownerAssignments = args.ownerAssignments || {};
  const { csOwnerAdminId, ownerAdminId } = resolveOwnerPins(ownerAssignments, admin);
  const inputPayload = {
    trainingRequestId,
    curriculumVersionId: String(curriculumVersionId),
    targetStartDate: args.targetStartDate || null,
    targetCompletionDate: args.targetCompletionDate || null,
    ownerAssignments,
  };
  const inputHash = hashProgramInput(inputPayload);

  const existingByKey = await prisma.customerTrainingProgram.findUnique({
    where: { idempotencyKey },
  });
  if (existingByKey) {
    if (existingByKey.inputHash && existingByKey.inputHash !== inputHash) {
      return {
        ok: false,
        error: 'idempotency_conflict',
        existingInputHash: existingByKey.inputHash,
        attemptedInputHash: inputHash,
      };
    }
    await ensureRequestConvertedToProgram(prisma, {
      admin,
      actorContext: args.actorContext,
      request,
      program: existingByKey,
      now,
    });
    return {
      ok: true,
      program: serializeTrainingProgram(existingByKey),
      alreadyExists: true,
      idempotentReplay: true,
      trainingCompleted: false,
      domain: getTrainingDomainContract(),
    };
  }

  const existingByRequest = await prisma.customerTrainingProgram.findFirst({
    where: { trainingRequestId },
  });
  if (existingByRequest) {
    await ensureRequestConvertedToProgram(prisma, {
      admin,
      actorContext: args.actorContext,
      request,
      program: existingByRequest,
      now,
    });
    return {
      ok: true,
      program: serializeTrainingProgram(existingByRequest),
      alreadyExists: true,
      idempotentReplay: true,
      trainingCompleted: false,
      domain: getTrainingDomainContract(),
    };
  }

  if (
    request.status !== TRAINING_REQUEST_STATUS.ACCEPTED &&
    request.status !== TRAINING_REQUEST_STATUS.CONVERTED_TO_PROGRAM
  ) {
    return {
      ok: false,
      error: `invalid_status_for_program_create: ${request.status}`,
    };
  }

  const trainingType = request.trainingType || TRAINING_TYPE.CUSTOMER_ONBOARDING;
  const activePurpose = await findActiveProgramForPurpose(prisma, {
    customerId: request.customerId,
    tenantId: request.tenantId,
    trainingType,
  });
  if (activePurpose) {
    return {
      ok: false,
      error: 'duplicate_active_program_purpose',
      existingProgramId: activePurpose.id,
      existingProgramNumber: activePurpose.programNumber || null,
      trainingType,
      customerId: request.customerId,
      tenantId: request.tenantId,
      domain: getTrainingDomainContract(),
    };
  }

  const allocated = await allocateTrainingProgramNumber(prisma, { now });
  if (!allocated.ok) {
    return {
      ok: false,
      error: allocated.error || 'training_program_number_allocation_failed',
    };
  }

  let row;
  try {
    row = await prisma.customerTrainingProgram.create({
      data: {
        programNumber: allocated.number,
        status: TRAINING_PROGRAM_STATUS.DRAFT,
        trainingType: request.trainingType || TRAINING_TYPE.CUSTOMER_ONBOARDING,
        trainingRequestId,
        handoffId: request.handoffId || null,
        conversionId: request.conversionId || null,
        onboardingProjectId: request.onboardingProjectId || null,
        customerId: request.customerId,
        tenantId: request.tenantId,
        subscriptionId: request.subscriptionId,
        curriculumVersionId: String(curriculumVersionId),
        targetStartDate: args.targetStartDate
          ? new Date(args.targetStartDate)
          : null,
        targetCompletionDate: args.targetCompletionDate
          ? new Date(args.targetCompletionDate)
          : null,
        ownerAssignmentsJson: ownerAssignments,
        csOwnerAdminId,
        ownerAdminId,
        inputHash,
        idempotencyKey,
        createdByAdminId: admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    try {
      let raced = await prisma.customerTrainingProgram.findUnique({
        where: { idempotencyKey },
      });
      if (!raced) {
        raced = await prisma.customerTrainingProgram.findFirst({
          where: { trainingRequestId },
        });
      }
      if (raced) {
        if (
          raced.idempotencyKey === idempotencyKey &&
          raced.inputHash &&
          raced.inputHash !== inputHash
        ) {
          return {
            ok: false,
            error: 'idempotency_conflict',
            existingInputHash: raced.inputHash,
            attemptedInputHash: inputHash,
          };
        }
        await ensureRequestConvertedToProgram(prisma, {
          admin,
          actorContext: args.actorContext,
          request,
          program: raced,
          now,
        });
        return {
          ok: true,
          program: serializeTrainingProgram(raced),
          alreadyExists: true,
          idempotentReplay: true,
          trainingCompleted: false,
          domain: getTrainingDomainContract(),
        };
      }
    } catch {
      // fall through
    }
    return { ok: false, error: err?.message || 'training_program_create_failed' };
  }

  await ensureRequestConvertedToProgram(prisma, {
    admin,
    actorContext: args.actorContext,
    request,
    program: row,
    now,
  });

  return {
    ok: true,
    program: serializeTrainingProgram(row),
    trainingCompleted: false,
    domain: getTrainingDomainContract(),
  };
}

export async function listTrainingPrograms(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canViewTraining(admin) && !canManageTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      error: 'training_list_forbidden',
      programs: [],
    };
  }
  if (!hasCustomerTrainingProgramModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_program_model_unavailable',
      status: 'UNAVAILABLE',
      programs: [],
    };
  }

  const scopeResult = await resolveTrainingListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    if (scopeResult.forbidden) {
      return {
        ok: false,
        forbidden: true,
        error: 'training_list_forbidden',
        programs: [],
      };
    }
    return {
      ok: true,
      programs: [],
      reason: scopeResult.reason,
      meta: { portfolioScoped: true, failClosed: true },
      domain: getTrainingDomainContract(),
    };
  }

  const where = { ...tenantWhereFromScope(scopeResult.tenantScope) };
  const rows = await prisma.customerTrainingProgram.findMany({ where });
  return {
    ok: true,
    programs: rows.map(serializeTrainingProgram),
    meta: {
      portfolioScoped: scopeResult.portfolioScoped,
      failClosed: scopeResult.portfolioScoped,
    },
    domain: getTrainingDomainContract(),
  };
}
