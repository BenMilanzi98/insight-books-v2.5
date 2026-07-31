/**
 * Training Cohorts — Phase 18 Wave 2.
 * Numbered; language; delivery mode; timezone; capacity.
 */

import {
  TRAINING_COHORT_STATUS,
  getTrainingDomainContract,
} from './catalogue.js';
import { allocateTrainingCohortNumber } from './numbering.js';
import {
  canManageTraining,
  hasCustomerTrainingCohortModel,
  hasCustomerTrainingProgramModel,
  resolveTrainingActor,
  serializeTrainingCohort,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';

/**
 * Create a Training Cohort with capacity bound to a Program.
 */
export async function createTrainingCohort(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_cohort_create_forbidden' };
  }
  if (!hasCustomerTrainingCohortModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_cohort_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const programId = args.programId ? String(args.programId).trim() : '';
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!programId) return { ok: false, error: 'programId_required' };
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  const capacity = Number(args.capacity);
  if (!Number.isFinite(capacity) || capacity < 1) {
    return { ok: false, error: 'capacity_required' };
  }

  const access = await loadTrainingProgramForActor(prisma, { ...args, programId });
  if (!access.ok) return access;

  const existing = await prisma.customerTrainingCohort.findUnique({
    where: { idempotencyKey },
  }).catch(async () =>
    prisma.customerTrainingCohort.findFirst({ where: { idempotencyKey } })
  );
  if (existing) {
    if (String(existing.programId) !== programId) {
      return {
        ok: false,
        error: 'idempotency_conflict',
        existingProgramId: existing.programId,
        attemptedProgramId: programId,
      };
    }
    return {
      ok: true,
      cohort: serializeTrainingCohort(existing),
      alreadyExists: true,
      idempotentReplay: true,
      domain: getTrainingDomainContract(),
    };
  }

  if (hasCustomerTrainingProgramModel(prisma) && !access.programRow && !access.program) {
    return { ok: false, error: 'program_not_found', notFound: true };
  }

  const programRow = access.programRow || access.program || {};
  if (
    args.customerId &&
    programRow.customerId &&
    String(args.customerId).trim() !== String(programRow.customerId).trim()
  ) {
    return {
      ok: false,
      error: 'cohort_customer_scope_mismatch',
      note: 'Unsafe multi-Customer cohort mix refused',
    };
  }
  if (
    args.tenantId &&
    programRow.tenantId &&
    String(args.tenantId).trim() !== String(programRow.tenantId).trim()
  ) {
    return { ok: false, error: 'cohort_tenant_scope_mismatch' };
  }

  const timezone = args.timezone != null ? String(args.timezone).trim() : '';
  if (!timezone) return { ok: false, error: 'timezone_required' };

  const now = args.now || new Date();
  const cohortNumber = await allocateTrainingCohortNumber(prisma, { now });

  const cohort = await prisma.customerTrainingCohort.create({
    data: {
      cohortNumber,
      programId,
      name: args.name ? String(args.name).trim() : null,
      language: args.language ? String(args.language).trim() : null,
      deliveryMode: args.deliveryMode ? String(args.deliveryMode).trim() : null,
      timezone,
      capacity: Math.floor(capacity),
      status: args.status || TRAINING_COHORT_STATUS.OPEN,
      customerId: programRow.customerId || null,
      tenantId: programRow.tenantId || null,
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    cohort: serializeTrainingCohort(cohort),
    created: true,
    domain: getTrainingDomainContract(),
  };
}
