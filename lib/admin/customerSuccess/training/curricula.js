/**
 * Curriculum seed + ACTIVE/immutability + Product≠Training module honesty — Phase 22 Wave 2.
 */

import {
  TRAINING_CURRICULUM_STATUS,
  TRAINING_TYPE,
  WAVE1_ONBOARDING_CURRICULUM_CODE,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canManageTraining,
  hasCustomerTrainingCurriculumModel,
  hasCustomerTrainingCurriculumVersionModel,
  hasCustomerTrainingProgramModel,
  resolveTrainingActor,
  serializeTrainingCurriculumVersion,
} from './model.js';

/**
 * Ensure a seeded ACTIVE onboarding curriculum version exists (idempotent).
 */
export async function ensureWave1OnboardingCurriculumVersion(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'training_curriculum_seed_forbidden',
    };
  }
  if (!hasCustomerTrainingCurriculumVersionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_curriculum_version_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const existing = await prisma.customerTrainingCurriculumVersion.findFirst({
    where: {
      curriculumCode: WAVE1_ONBOARDING_CURRICULUM_CODE,
      trainingType: TRAINING_TYPE.CUSTOMER_ONBOARDING,
      status: TRAINING_CURRICULUM_STATUS.ACTIVE,
    },
  });
  if (existing) {
    return {
      ok: true,
      curriculumVersion: serializeTrainingCurriculumVersion(existing),
      alreadyExists: true,
      domain: getTrainingDomainContract(),
    };
  }

  const now = args.now || new Date();
  let curriculumId = null;

  if (hasCustomerTrainingCurriculumModel(prisma)) {
    let curriculum = await prisma.customerTrainingCurriculum.findFirst({
      where: { curriculumCode: WAVE1_ONBOARDING_CURRICULUM_CODE },
    });
    if (!curriculum) {
      curriculum = await prisma.customerTrainingCurriculum.create({
        data: {
          curriculumCode: WAVE1_ONBOARDING_CURRICULUM_CODE,
          name: 'Customer Onboarding Training (Wave 1)',
          trainingType: TRAINING_TYPE.CUSTOMER_ONBOARDING,
          status: TRAINING_CURRICULUM_STATUS.ACTIVE,
          createdByAdminId: admin?.id || null,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    curriculumId = curriculum.id;
  }

  const row = await prisma.customerTrainingCurriculumVersion.create({
    data: {
      curriculumId,
      curriculumCode: WAVE1_ONBOARDING_CURRICULUM_CODE,
      versionNumber: 1,
      trainingType: TRAINING_TYPE.CUSTOMER_ONBOARDING,
      status: TRAINING_CURRICULUM_STATUS.ACTIVE,
      immutable: true,
      contentJson: {
        wave: 1,
        sessionsDeferred: true,
        modules: [],
        assessments: [],
      },
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    curriculumVersion: serializeTrainingCurriculumVersion(row),
    created: true,
    domain: getTrainingDomainContract(),
  };
}

/**
 * Product catalogue modules must never be treated as Training modules.
 * Product refs stay explicit (`productModuleRef`) and distinct from `trainingModuleId`.
 */
export function assertTrainingModuleNotProductModule(args = {}) {
  const trainingModuleId = args.trainingModuleId
    ? String(args.trainingModuleId).trim()
    : '';
  const productModuleId = args.productModuleId
    ? String(args.productModuleId).trim()
    : '';
  const productModuleRef = args.productModuleRef
    ? String(args.productModuleRef).trim()
    : productModuleId || '';
  const moduleKind = args.moduleKind
    ? String(args.moduleKind).trim().toUpperCase()
    : '';

  if (args.isProductModule === true || moduleKind === 'PRODUCT') {
    return {
      ok: false,
      error: 'product_module_not_training_module',
      note: 'Product modules ≠ Training modules; use productModuleRef for entitlement bind only',
    };
  }

  if (
    trainingModuleId &&
    productModuleId &&
    trainingModuleId === productModuleId
  ) {
    return {
      ok: false,
      error: 'product_module_confused_as_training_module',
      trainingModuleId,
      productModuleId,
    };
  }

  if (
    trainingModuleId &&
    /^prod[-_]?mod/i.test(trainingModuleId) &&
    !productModuleRef
  ) {
    return {
      ok: false,
      error: 'product_module_confused_as_training_module',
      trainingModuleId,
    };
  }

  if (!trainingModuleId && !args.trainingModuleCode) {
    return { ok: false, error: 'training_module_id_or_code_required' };
  }

  return {
    ok: true,
    trainingModuleId: trainingModuleId || null,
    trainingModuleCode: args.trainingModuleCode
      ? String(args.trainingModuleCode).trim()
      : null,
    productModuleRef: productModuleRef || null,
  };
}

async function assertCurriculumVersionMutable(prisma, curriculumVersionId) {
  if (!hasCustomerTrainingCurriculumVersionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_curriculum_version_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const versionId = String(curriculumVersionId || '').trim();
  if (!versionId) return { ok: false, error: 'curriculumVersionId_required' };

  const row = await prisma.customerTrainingCurriculumVersion.findUnique({
    where: { id: versionId },
  });
  if (!row) {
    return { ok: false, error: 'curriculum_version_not_found', notFound: true };
  }

  const status = String(row.status || '').trim().toUpperCase();
  // ACTIVE / explicitly frozen / Program-applied → immutable.
  // DRAFT defaults immutable=false so authoring + role-module bind can proceed.
  if (status === TRAINING_CURRICULUM_STATUS.ACTIVE) {
    return {
      ok: false,
      error: 'curriculum_version_immutable_ACTIVE_or_frozen',
      status,
      immutable: true,
      curriculumVersionId: versionId,
    };
  }
  if (row.immutable === true) {
    return {
      ok: false,
      error: 'curriculum_version_immutable_ACTIVE_or_frozen',
      status,
      immutable: true,
      curriculumVersionId: versionId,
    };
  }

  if (hasCustomerTrainingProgramModel(prisma)) {
    const applied = await prisma.customerTrainingProgram.findFirst({
      where: { curriculumVersionId: versionId },
    });
    if (applied) {
      return {
        ok: false,
        error: 'curriculum_version_immutable_applied_to_program',
        programId: applied.id,
        curriculumVersionId: versionId,
      };
    }
  }

  return { ok: true, row };
}

/**
 * Update a DRAFT curriculum version. ACTIVE / immutable / Program-applied versions refuse.
 */
export async function updateTrainingCurriculumVersion(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'training_curriculum_update_forbidden',
    };
  }

  const mutable = await assertCurriculumVersionMutable(
    prisma,
    args.curriculumVersionId
  );
  if (!mutable.ok) return mutable;

  const data = { updatedAt: args.now || new Date() };
  if (args.contentJson !== undefined) data.contentJson = args.contentJson;
  if (args.status != null) {
    data.status = String(args.status).trim().toUpperCase();
    // Freeze on transition to ACTIVE (Spec §8).
    if (data.status === TRAINING_CURRICULUM_STATUS.ACTIVE) {
      data.immutable = true;
    }
  }
  if (args.immutable === true) data.immutable = true;

  const row = await prisma.customerTrainingCurriculumVersion.update({
    where: { id: mutable.row.id },
    data,
  });

  return {
    ok: true,
    curriculumVersion: serializeTrainingCurriculumVersion(row),
    domain: getTrainingDomainContract(),
  };
}

/**
 * Bind role → Training module entitlement with an explicit Product module ref.
 * Never mutates ACTIVE / applied curriculum versions.
 */
export async function bindTrainingModuleRoleEntitlement(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'training_role_module_bind_forbidden',
    };
  }

  const refs = assertTrainingModuleNotProductModule({
    trainingModuleId: args.trainingModuleId,
    trainingModuleCode: args.trainingModuleCode,
    productModuleRef: args.productModuleRef,
    productModuleId: args.productModuleId,
    moduleKind: args.moduleKind,
  });
  if (!refs.ok) return refs;

  const roleCode = args.roleCode ? String(args.roleCode).trim() : '';
  if (!roleCode) return { ok: false, error: 'roleCode_required' };
  if (!refs.productModuleRef) {
    return { ok: false, error: 'productModuleRef_required' };
  }

  const mutable = await assertCurriculumVersionMutable(
    prisma,
    args.curriculumVersionId
  );
  if (!mutable.ok) return mutable;

  const content =
    mutable.row.contentJson && typeof mutable.row.contentJson === 'object'
      ? { ...mutable.row.contentJson }
      : {};
  const bindings = Array.isArray(content.roleModuleBindings)
    ? [...content.roleModuleBindings]
    : [];
  bindings.push({
    roleCode,
    trainingModuleCode: refs.trainingModuleCode || refs.trainingModuleId,
    productModuleRef: refs.productModuleRef,
    boundAt: (args.now || new Date()).toISOString(),
    boundByAdminId: admin?.id || null,
  });
  content.roleModuleBindings = bindings;

  const row = await prisma.customerTrainingCurriculumVersion.update({
    where: { id: mutable.row.id },
    data: {
      contentJson: content,
      updatedAt: args.now || new Date(),
    },
  });

  return {
    ok: true,
    curriculumVersion: serializeTrainingCurriculumVersion(row),
    binding: bindings[bindings.length - 1],
    domain: getTrainingDomainContract(),
  };
}
