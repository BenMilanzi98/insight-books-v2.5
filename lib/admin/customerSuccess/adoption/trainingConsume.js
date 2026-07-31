/**
 * Consume Phase 18 Training Program COMPLETED → CustomerAdoptionRequest.
 * COMPLETED_WITH_GAPS / IN_PROGRESS / partial → no Request.
 * Portfolio fail-closed: program tenant must be in actor portfolio before create.
 */

import {
  ADOPTION_REQUEST_SOURCE,
  getAdoptionDomainContract,
} from './catalogue.js';
import {
  canManageAdoption,
  hasCustomerAdoptionRequestModel,
  hasCustomerTrainingProgramModel,
  resolveAdoptionActor,
} from './model.js';
import { createAdoptionRequest } from './requests.js';
import { assertAdoptionTenantInScope } from './listScope.js';
import { resolveActorTenantId } from './planAccess.js';

const ELIGIBLE_PROGRAM_STATUS = 'COMPLETED';

/**
 * Training planAccess equivalent for adoption consume writes.
 * Loads program + enforces Cross-Tenant + portfolio intersect (fail closed).
 */
async function loadTrainingProgramForAdoptionActor(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return {
      ok: false,
      forbidden: true,
      error: 'adoption_training_consume_forbidden',
    };
  }
  if (!hasCustomerTrainingProgramModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_program_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const programId = args.programId ? String(args.programId).trim() : '';
  if (!programId) {
    return { ok: false, error: 'program_id_required' };
  }

  const program = await prisma.customerTrainingProgram.findUnique({
    where: { id: programId },
  });
  if (!program) {
    return { ok: false, notFound: true, error: 'training_program_not_found' };
  }

  const actorTenantId = resolveActorTenantId(args);
  if (
    actorTenantId &&
    program.tenantId &&
    String(program.tenantId).trim() !== actorTenantId
  ) {
    return {
      ok: false,
      forbidden: true,
      error: 'cross_tenant_denied',
      lockedTenantId: program.tenantId,
      requestedTenantId: actorTenantId,
    };
  }

  const scopeGate = await assertAdoptionTenantInScope(
    prisma,
    admin,
    args,
    program.tenantId
  );
  if (!scopeGate.ok) return scopeGate;

  return { ok: true, program, programRow: program, admin, actorTenantId };
}

/**
 * Auto-create ADR Request only when Training Program aggregate is COMPLETED.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ actorContext?: object, admin?: object, programId: string, idempotencyKey: string, now?: Date }} args
 */
export async function consumeTrainingCompletionForAdoption(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'adoption_training_consume_forbidden',
    };
  }
  if (!hasCustomerAdoptionRequestModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const programId = args.programId ? String(args.programId).trim() : '';
  if (!programId) {
    return { ok: false, error: 'program_id_required' };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : `adr-from-trn:${programId}`;
  if (!idempotencyKey) {
    return { ok: false, error: 'idempotency_key_required' };
  }

  const programAccess = await loadTrainingProgramForAdoptionActor(prisma, {
    ...args,
    admin,
    programId,
  });
  if (!programAccess.ok) return programAccess;
  const program = programAccess.programRow || programAccess.program;

  const status = String(program.status || '')
    .trim()
    .toUpperCase();

  if (status !== ELIGIBLE_PROGRAM_STATUS) {
    return {
      ok: false,
      error:
        status === 'COMPLETED_WITH_GAPS'
          ? 'training_program_COMPLETED_WITH_GAPS_not_eligible_for_auto_adoption_request'
          : status === 'IN_PROGRESS'
            ? 'training_program_IN_PROGRESS_not_eligible_for_auto_adoption_request'
            : `training_program_aggregate_not_COMPLETED: ${status || 'UNKNOWN'}`,
      programStatus: status,
      programId: program.id,
      domain: getAdoptionDomainContract(),
    };
  }

  const tenantId = args.tenantId || program.tenantId || null;

  const created = await createAdoptionRequest(prisma, {
    ...args,
    admin,
    actorContext: args.actorContext || { admin },
    source: ADOPTION_REQUEST_SOURCE.PHASE_18_TRAINING_COMPLETED,
    trainingProgramId: program.id,
    onboardingProjectId: program.onboardingProjectId || null,
    customerId: args.customerId || program.customerId || null,
    tenantId,
    subscriptionId: args.subscriptionId || program.subscriptionId || null,
    payloadJson: {
      type: 'ADOPTION_FROM_TRAINING_COMPLETED',
      trainingProgramId: program.id,
      trainingProgramNumber: program.programNumber || null,
      trainingProgramStatus: status,
      conversionId: program.conversionId || null,
      handoffId: program.handoffId || null,
      fabricatedTrainingCompleted: false,
    },
    idempotencyKey,
  });

  if (!created.ok) return created;

  return {
    ...created,
    programId: program.id,
    programStatus: status,
    trainingCompleted: true,
    fabricatedTrainingCompleted: false,
    domain: getAdoptionDomainContract(),
  };
}
