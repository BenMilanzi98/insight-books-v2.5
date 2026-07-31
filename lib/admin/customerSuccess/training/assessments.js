/**
 * Training Assessments — Phase 22 Wave 3 harden.
 * Knowledge-check / practical; published versions immutable; answer-key protected.
 */

import {
  TRAINING_ASSESSMENT_TYPE,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canManageTraining,
  hasCustomerTrainingAssessmentModel,
  hasCustomerTrainingAssessmentVersionModel,
  resolveTrainingActor,
  serializeTrainingAssessment,
  serializeTrainingAssessmentVersion,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';

const TYPE_SET = new Set(Object.values(TRAINING_ASSESSMENT_TYPE));

function isPublishedOrImmutable(version) {
  if (!version) return false;
  if (version.immutable === true) return true;
  const status = String(version.status || '').toUpperCase();
  return status === 'PUBLISHED' || status === 'ACTIVE';
}

export async function createTrainingAssessment(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_assessment_create_forbidden' };
  }
  if (
    !hasCustomerTrainingAssessmentModel(prisma) ||
    !hasCustomerTrainingAssessmentVersionModel(prisma)
  ) {
    return {
      ok: false,
      error: 'customer_training_assessment_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const programId = args.programId ? String(args.programId).trim() : '';
  const title = args.title ? String(args.title).trim() : '';
  const assessmentType = String(args.assessmentType || TRAINING_ASSESSMENT_TYPE.KNOWLEDGE_CHECK)
    .trim()
    .toUpperCase();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  const maxAttempts = Number(args.maxAttempts ?? 2);
  const durationMinutes = Number(args.durationMinutes ?? 30);
  const passScore = Number(args.passScore ?? 70);
  const asDraft = args.draft === true;

  if (!programId) return { ok: false, error: 'programId_required' };
  if (!title) return { ok: false, error: 'title_required' };
  if (!TYPE_SET.has(assessmentType)) {
    return { ok: false, error: 'invalid_assessment_type' };
  }
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };
  if (!Number.isFinite(maxAttempts) || maxAttempts < 1) {
    return { ok: false, error: 'invalid_max_attempts' };
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
    return { ok: false, error: 'invalid_duration_minutes' };
  }

  const access = await loadTrainingProgramForActor(prisma, { ...args, programId });
  if (!access.ok) return access;

  const existing = await prisma.customerTrainingAssessment.findFirst({
    where: { idempotencyKey },
  });
  if (existing) {
    const version = await prisma.customerTrainingAssessmentVersion.findFirst({
      where: { assessmentId: existing.id },
    });
    return {
      ok: true,
      assessment: serializeTrainingAssessment(existing),
      version: serializeTrainingAssessmentVersion(version),
      alreadyExists: true,
      idempotentReplay: true,
      domain: getTrainingDomainContract(),
    };
  }

  const now = args.now || new Date();
  const assessment = await prisma.customerTrainingAssessment.create({
    data: {
      programId,
      title,
      assessmentType,
      status: asDraft ? 'DRAFT' : 'ACTIVE',
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  const version = await prisma.customerTrainingAssessmentVersion.create({
    data: {
      assessmentId: assessment.id,
      versionNumber: 1,
      maxAttempts,
      durationMinutes,
      passScore,
      questionsJson: args.questionsJson ?? null,
      immutable: asDraft ? false : true,
      status: asDraft ? 'DRAFT' : 'ACTIVE',
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    assessment: serializeTrainingAssessment(assessment),
    version: serializeTrainingAssessmentVersion(version),
    created: true,
    domain: getTrainingDomainContract(),
  };
}

/**
 * Publish a DRAFT assessment version — becomes immutable.
 */
export async function publishTrainingAssessmentVersion(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_assessment_publish_forbidden' };
  }
  if (!hasCustomerTrainingAssessmentVersionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_assessment_version_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const assessmentVersionId = args.assessmentVersionId
    ? String(args.assessmentVersionId).trim()
    : '';
  if (!assessmentVersionId) return { ok: false, error: 'assessmentVersionId_required' };

  const version = await prisma.customerTrainingAssessmentVersion.findUnique({
    where: { id: assessmentVersionId },
  });
  if (!version) {
    return { ok: false, notFound: true, error: 'assessment_version_not_found' };
  }

  const assessment = await prisma.customerTrainingAssessment.findUnique({
    where: { id: version.assessmentId },
  });
  if (assessment?.programId) {
    const access = await loadTrainingProgramForActor(prisma, {
      ...args,
      programId: assessment.programId,
    });
    if (!access.ok) return access;
  }

  if (version.immutable === true && String(version.status || '').toUpperCase() !== 'DRAFT') {
    return {
      ok: true,
      version: serializeTrainingAssessmentVersion(version),
      alreadyExists: true,
      idempotentReplay: true,
      domain: getTrainingDomainContract(),
    };
  }

  const now = args.now || new Date();
  const updated = await prisma.customerTrainingAssessmentVersion.update({
    where: { id: assessmentVersionId },
    data: {
      immutable: true,
      status: 'PUBLISHED',
      updatedAt: now,
    },
  });

  if (assessment) {
    await prisma.customerTrainingAssessment.update({
      where: { id: assessment.id },
      data: { status: 'ACTIVE', updatedAt: now },
    });
  }

  return {
    ok: true,
    version: serializeTrainingAssessmentVersion(updated),
    created: true,
    domain: getTrainingDomainContract(),
  };
}

/**
 * Update DRAFT assessment version only — published/immutable refuse.
 */
export async function updateTrainingAssessmentVersion(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_assessment_update_forbidden' };
  }
  if (!hasCustomerTrainingAssessmentVersionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_assessment_version_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const assessmentVersionId = args.assessmentVersionId
    ? String(args.assessmentVersionId).trim()
    : '';
  if (!assessmentVersionId) return { ok: false, error: 'assessmentVersionId_required' };

  const version = await prisma.customerTrainingAssessmentVersion.findUnique({
    where: { id: assessmentVersionId },
  });
  if (!version) {
    return { ok: false, notFound: true, error: 'assessment_version_not_found' };
  }

  if (isPublishedOrImmutable(version) && String(version.status || '').toUpperCase() !== 'DRAFT') {
    return {
      ok: false,
      error: 'assessment_version_immutable_published',
      immutable: true,
      status: version.status,
    };
  }
  if (version.immutable === true) {
    return {
      ok: false,
      error: 'assessment_version_immutable_published',
      immutable: true,
    };
  }

  const assessment = await prisma.customerTrainingAssessment.findUnique({
    where: { id: version.assessmentId },
  });
  if (assessment?.programId) {
    const access = await loadTrainingProgramForActor(prisma, {
      ...args,
      programId: assessment.programId,
    });
    if (!access.ok) return access;
  }

  const data = { updatedAt: args.now || new Date() };
  if (args.maxAttempts != null) data.maxAttempts = Number(args.maxAttempts);
  if (args.durationMinutes != null) data.durationMinutes = Number(args.durationMinutes);
  if (args.passScore != null) data.passScore = Number(args.passScore);
  if (args.questionsJson !== undefined) data.questionsJson = args.questionsJson;

  const updated = await prisma.customerTrainingAssessmentVersion.update({
    where: { id: assessmentVersionId },
    data,
  });

  return {
    ok: true,
    version: serializeTrainingAssessmentVersion(updated),
    domain: getTrainingDomainContract(),
  };
}
