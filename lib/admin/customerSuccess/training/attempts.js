/**
 * Assessment Attempts — Phase 18 Wave 3.
 * Server-authoritative timer + attempt limits; answers excluded from list payloads.
 */

import {
  TRAINING_ATTEMPT_STATUS,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canManageTraining,
  canViewTraining,
  hasCustomerTrainingAssessmentAttemptModel,
  hasCustomerTrainingAssessmentVersionModel,
  resolveTrainingActor,
  serializeTrainingAssessmentAttempt,
  serializeTrainingAssessmentAttemptListItem,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';
import {
  resolveTrainingListScope,
  tenantWhereFromScope,
} from './listScope.js';

async function loadVersion(prisma, assessmentVersionId) {
  if (!hasCustomerTrainingAssessmentVersionModel(prisma)) return null;
  return prisma.customerTrainingAssessmentVersion.findUnique({
    where: { id: assessmentVersionId },
  });
}

/**
 * Validate idempotent attempt replay against version + participant (+ optional program/enrolment).
 */
function assertAttemptIdempotencyMatch(
  existing,
  { assessmentVersionId, participantId, programId, enrolmentId }
) {
  if (String(existing.assessmentVersionId) !== assessmentVersionId) {
    return {
      ok: false,
      error: 'idempotency_conflict',
      field: 'assessmentVersionId',
    };
  }
  if (String(existing.participantId) !== participantId) {
    return {
      ok: false,
      error: 'idempotency_conflict',
      field: 'participantId',
    };
  }
  if (programId && existing.programId && String(existing.programId) !== programId) {
    return {
      ok: false,
      error: 'idempotency_conflict',
      field: 'programId',
    };
  }
  if (
    enrolmentId &&
    existing.enrolmentId != null &&
    String(existing.enrolmentId) !== enrolmentId
  ) {
    return {
      ok: false,
      error: 'idempotency_conflict',
      field: 'enrolmentId',
    };
  }
  return { ok: true };
}

async function assertProgramForVersion(prisma, args, version) {
  if (!version) return { ok: false, notFound: true, error: 'assessment_version_not_found' };
  const assessment = await prisma.customerTrainingAssessment.findUnique({
    where: { id: version.assessmentId },
  });
  if (!assessment) {
    return { ok: false, notFound: true, error: 'assessment_not_found' };
  }
  const access = await loadTrainingProgramForActor(prisma, {
    ...args,
    programId: assessment.programId,
  });
  if (!access.ok) return access;
  return { ok: true, assessment, program: access.programRow || access.program };
}

export async function startAssessmentAttempt(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_attempt_start_forbidden' };
  }
  if (!hasCustomerTrainingAssessmentAttemptModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_assessment_attempt_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const assessmentVersionId = args.assessmentVersionId
    ? String(args.assessmentVersionId).trim()
    : '';
  const participantId = args.participantId ? String(args.participantId).trim() : '';
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';

  if (!assessmentVersionId) return { ok: false, error: 'assessmentVersionId_required' };
  if (!participantId) return { ok: false, error: 'participantId_required' };
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  if (args.programId || args.tenantId || args.actorContext?.tenantId) {
    // Explicit program/tenant pin — deny early when Cross-Tenant
    if (args.programId) {
      const access = await loadTrainingProgramForActor(prisma, {
        ...args,
        programId: args.programId,
      });
      if (!access.ok) return access;
    }
  }

  const existing = await prisma.customerTrainingAssessmentAttempt.findFirst({
    where: { idempotencyKey },
  });
  if (existing) {
    const match = assertAttemptIdempotencyMatch(existing, {
      assessmentVersionId,
      participantId,
      programId: args.programId ? String(args.programId).trim() : '',
      enrolmentId: args.enrolmentId ? String(args.enrolmentId).trim() : '',
    });
    if (!match.ok) return match;
    return {
      ok: true,
      attempt: serializeTrainingAssessmentAttempt(existing),
      alreadyExists: true,
      idempotentReplay: true,
      domain: getTrainingDomainContract(),
    };
  }

  const version = await loadVersion(prisma, assessmentVersionId);
  const scoped = await assertProgramForVersion(prisma, args, version);
  if (!scoped.ok) return scoped;

  const prior = await prisma.customerTrainingAssessmentAttempt.findMany({
    where: { assessmentVersionId, participantId },
  });
  const counted = prior.filter(
    (a) => a.status !== TRAINING_ATTEMPT_STATUS.EXPIRED || a.countsTowardLimit !== false
  );
  const maxAttempts = Number(version.maxAttempts || 1);
  if (counted.length >= maxAttempts) {
    return {
      ok: false,
      error: 'attempt_limit_exceeded',
      maxAttempts,
      attemptsUsed: counted.length,
    };
  }

  const now = args.now || new Date();
  const durationMinutes = Number(version.durationMinutes || 30);
  const serverEndsAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

  const attempt = await prisma.customerTrainingAssessmentAttempt.create({
    data: {
      assessmentId: version.assessmentId,
      assessmentVersionId,
      participantId,
      programId: scoped.assessment.programId,
      status: TRAINING_ATTEMPT_STATUS.IN_PROGRESS,
      attemptNumber: counted.length + 1,
      serverStartedAt: now,
      serverEndsAt,
      countsTowardLimit: true,
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    attempt: serializeTrainingAssessmentAttempt(attempt),
    created: true,
    domain: getTrainingDomainContract(),
  };
}

export async function submitAssessmentAttempt(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_attempt_submit_forbidden' };
  }
  if (!hasCustomerTrainingAssessmentAttemptModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_assessment_attempt_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const attemptId = args.attemptId ? String(args.attemptId).trim() : '';
  if (!attemptId) return { ok: false, error: 'attemptId_required' };

  const attempt = await prisma.customerTrainingAssessmentAttempt.findUnique({
    where: { id: attemptId },
  });
  if (!attempt) return { ok: false, notFound: true, error: 'attempt_not_found' };

  if (attempt.programId) {
    const access = await loadTrainingProgramForActor(prisma, {
      ...args,
      programId: attempt.programId,
    });
    if (!access.ok) return access;
  }

  if (
    attempt.status !== TRAINING_ATTEMPT_STATUS.IN_PROGRESS &&
    attempt.status !== TRAINING_ATTEMPT_STATUS.SUBMITTED
  ) {
    if (attempt.status === TRAINING_ATTEMPT_STATUS.EXPIRED) {
      return { ok: false, error: 'attempt_timer_expired' };
    }
    return { ok: false, error: 'attempt_not_submittable', status: attempt.status };
  }

  const now = args.now || new Date();
  const endsAt = attempt.serverEndsAt ? new Date(attempt.serverEndsAt) : null;
  // Client timer is not authoritative — only serverEndsAt matters.
  if (endsAt && now.getTime() > endsAt.getTime()) {
    await prisma.customerTrainingAssessmentAttempt.update({
      where: { id: attemptId },
      data: {
        status: TRAINING_ATTEMPT_STATUS.EXPIRED,
        updatedAt: now,
      },
    });
    return { ok: false, error: 'attempt_timer_expired', serverEndsAt: endsAt.toISOString() };
  }

  const updated = await prisma.customerTrainingAssessmentAttempt.update({
    where: { id: attemptId },
    data: {
      status: TRAINING_ATTEMPT_STATUS.SUBMITTED,
      answersJson: args.answersJson ?? null,
      submittedAt: now,
      clientTimerExpiredClaim:
        args.clientTimerExpired === true || args.clientTimerExpired === false
          ? Boolean(args.clientTimerExpired)
          : null,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    attempt: serializeTrainingAssessmentAttempt(updated),
    domain: getTrainingDomainContract(),
  };
}

export async function listAssessmentAttempts(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canViewTraining(admin) && !canManageTraining(admin)) {
    return { ok: false, forbidden: true, error: 'training_attempt_list_forbidden', attempts: [] };
  }
  if (!hasCustomerTrainingAssessmentAttemptModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_assessment_attempt_model_unavailable',
      status: 'UNAVAILABLE',
      attempts: [],
    };
  }

  // Portfolio / program scope fail-closed — never unscoped fleet enumeration.
  const programId = args.programId ? String(args.programId).trim() : '';
  if (programId) {
    const access = await loadTrainingProgramForActor(prisma, { ...args, programId });
    if (!access.ok) {
      return { ...access, attempts: [] };
    }
  } else {
    const scopeResult = await resolveTrainingListScope(prisma, admin, args);
    if (!scopeResult.ok) {
      if (scopeResult.forbidden) {
        return {
          ok: false,
          forbidden: true,
          error: 'training_attempt_list_forbidden',
          attempts: [],
        };
      }
      return {
        ok: true,
        attempts: [],
        reason: scopeResult.reason,
        status: 'UNAVAILABLE',
        meta: { portfolioScoped: true, failClosed: true },
        domain: getTrainingDomainContract(),
      };
    }

    // Without an explicit program pin, restrict to in-scope programIds only.
    if (scopeResult.tenantScope) {
      const programs =
        typeof prisma.customerTrainingProgram?.findMany === 'function'
          ? await prisma.customerTrainingProgram.findMany({
              where: tenantWhereFromScope(scopeResult.tenantScope),
            })
          : [];
      const scopedProgramIds = (programs || []).map((p) => p.id);
      if (!scopedProgramIds.length) {
        return {
          ok: true,
          attempts: [],
          reason: 'portfolio_scope_empty_programs',
          meta: { portfolioScoped: true, failClosed: true },
          domain: getTrainingDomainContract(),
        };
      }
      args = { ...args, _scopedProgramIds: scopedProgramIds };
    }
  }

  const where = {};
  if (programId) {
    where.programId = programId;
  } else if (args._scopedProgramIds) {
    where.programId = { in: args._scopedProgramIds };
  }
  if (args.assessmentVersionId) {
    where.assessmentVersionId = String(args.assessmentVersionId).trim();
  }
  if (args.participantId) {
    where.participantId = String(args.participantId).trim();
  }
  if (args.assessmentId) {
    where.assessmentId = String(args.assessmentId).trim();
  }

  const rows = await prisma.customerTrainingAssessmentAttempt.findMany({ where });
  return {
    ok: true,
    attempts: rows.map(serializeTrainingAssessmentAttemptListItem),
    meta: { portfolioScoped: true },
    domain: getTrainingDomainContract(),
  };
}

export async function retakeAssessment(prisma, args = {}) {
  return startAssessmentAttempt(prisma, args);
}
