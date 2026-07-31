/**
 * CustomerTraining* model guards + serializers — Phase 18 Wave 1–3.
 */

import {
  TRAINING_REQUEST_STATUS,
  TRAINING_PROGRAM_STATUS,
  TRAINING_PARTICIPANT_VERIFICATION,
  TRAINING_ENROLMENT_STATUS,
  TRAINING_COHORT_STATUS,
  TRAINING_SESSION_STATUS,
  TRAINING_ATTENDANCE_STATUS,
  TRAINING_MATERIAL_CLASSIFICATION,
  TRAINING_EXERCISE_STATUS,
  TRAINING_ATTEMPT_STATUS,
  TRAINING_RESULT_STATUS,
  TRAINING_COMPLETION_STATUS,
  TRAINING_CERTIFICATE_VERIFICATION,
  getTrainingDomainContract,
} from './catalogue.js';
import { resolveCsAccess } from '../authz.js';

export function hasCustomerTrainingRequestModel(prisma) {
  return typeof prisma?.customerTrainingRequest?.create === 'function';
}

export function hasCustomerTrainingRequestStatusHistoryModel(prisma) {
  return typeof prisma?.customerTrainingRequestStatusHistory?.create === 'function';
}

export function hasCustomerTrainingProgramModel(prisma) {
  return typeof prisma?.customerTrainingProgram?.create === 'function';
}

export function hasCustomerTrainingProgramStatusHistoryModel(prisma) {
  return typeof prisma?.customerTrainingProgramStatusHistory?.create === 'function';
}

export function hasCustomerTrainingCurriculumModel(prisma) {
  return typeof prisma?.customerTrainingCurriculum?.create === 'function';
}

export function hasCustomerTrainingCurriculumVersionModel(prisma) {
  return typeof prisma?.customerTrainingCurriculumVersion?.create === 'function';
}

export function hasCustomerTrainingModuleModel(prisma) {
  return typeof prisma?.customerTrainingModule?.create === 'function';
}

export function hasCustomerTrainingModuleVersionModel(prisma) {
  return typeof prisma?.customerTrainingModuleVersion?.create === 'function';
}

export function hasCustomerTrainingCohortModel(prisma) {
  return typeof prisma?.customerTrainingCohort?.create === 'function';
}

export function hasCustomerTrainingParticipantModel(prisma) {
  return typeof prisma?.customerTrainingParticipant?.create === 'function';
}

export function hasCustomerTrainingEnrolmentModel(prisma) {
  return typeof prisma?.customerTrainingEnrolment?.create === 'function';
}

export function hasCustomerTrainingInvitationModel(prisma) {
  return typeof prisma?.customerTrainingInvitation?.create === 'function';
}

export function hasCustomerTrainingTrainerModel(prisma) {
  return typeof prisma?.customerTrainingTrainer?.create === 'function';
}

export function hasCustomerTrainingTrainerAssignmentModel(prisma) {
  return typeof prisma?.customerTrainingTrainerAssignment?.create === 'function';
}

export function hasCustomerTrainingSessionModel(prisma) {
  return typeof prisma?.customerTrainingSession?.create === 'function';
}

export function hasCustomerTrainingAttendanceModel(prisma) {
  return typeof prisma?.customerTrainingAttendance?.create === 'function';
}

export function hasCustomerTrainingMaterialModel(prisma) {
  return typeof prisma?.customerTrainingMaterial?.create === 'function';
}

export function hasCustomerTrainingConflictModel(prisma) {
  return typeof prisma?.customerTrainingConflict?.create === 'function';
}

export function hasCustomerTrainingExerciseModel(prisma) {
  return typeof prisma?.customerTrainingExercise?.create === 'function';
}

export function hasCustomerTrainingAssessmentModel(prisma) {
  return typeof prisma?.customerTrainingAssessment?.create === 'function';
}

export function hasCustomerTrainingAssessmentVersionModel(prisma) {
  return typeof prisma?.customerTrainingAssessmentVersion?.create === 'function';
}

export function hasCustomerTrainingAssessmentAttemptModel(prisma) {
  return typeof prisma?.customerTrainingAssessmentAttempt?.create === 'function';
}

export function hasCustomerTrainingAssessmentResultModel(prisma) {
  return typeof prisma?.customerTrainingAssessmentResult?.create === 'function';
}

export function hasCustomerTrainingAssessmentRegradeModel(prisma) {
  return typeof prisma?.customerTrainingAssessmentRegrade?.create === 'function';
}

export function hasCustomerTrainingParticipantCompletionModel(prisma) {
  return typeof prisma?.customerTrainingParticipantCompletion?.create === 'function';
}

export function hasCustomerTrainingProgramCompletionModel(prisma) {
  return typeof prisma?.customerTrainingProgramCompletion?.create === 'function';
}

export function hasCustomerTrainingCertificateModel(prisma) {
  return typeof prisma?.customerTrainingCertificate?.create === 'function';
}

export function resolveTrainingActor(args = {}) {
  return args.admin || args.actorContext?.admin || args.actorContext || null;
}

export function canManageTraining(admin) {
  const access = resolveCsAccess(admin);
  return Boolean(access?.canManageCases || access?.isSuperAdmin);
}

export function canViewTraining(admin) {
  const access = resolveCsAccess(admin);
  return Boolean(access?.canView || access?.isSuperAdmin);
}

export function serializeTrainingRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    requestNumber: row.requestNumber,
    status: row.status || TRAINING_REQUEST_STATUS.NEW,
    source: row.source || null,
    trainingType: row.trainingType || null,
    handoffId: row.handoffId || null,
    conversionId: row.conversionId || null,
    onboardingProjectId: row.onboardingProjectId || null,
    customerId: row.customerId || null,
    tenantId: row.tenantId || null,
    subscriptionId: row.subscriptionId || null,
    payloadJson: row.payloadJson ?? null,
    ownerAdminId: row.ownerAdminId || null,
    createdByAdminId: row.createdByAdminId || null,
    programId: row.programId || null,
    inputHash: row.inputHash || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeTrainingProgram(row) {
  if (!row) return null;
  return {
    id: row.id,
    programNumber: row.programNumber,
    status: row.status || TRAINING_PROGRAM_STATUS.DRAFT,
    trainingType: row.trainingType || null,
    trainingRequestId: row.trainingRequestId || null,
    handoffId: row.handoffId || null,
    conversionId: row.conversionId || null,
    onboardingProjectId: row.onboardingProjectId || null,
    customerId: row.customerId || null,
    tenantId: row.tenantId || null,
    subscriptionId: row.subscriptionId || null,
    curriculumVersionId: row.curriculumVersionId || null,
    targetStartDate: row.targetStartDate
      ? new Date(row.targetStartDate).toISOString()
      : null,
    targetCompletionDate: row.targetCompletionDate
      ? new Date(row.targetCompletionDate).toISOString()
      : null,
    ownerAssignmentsJson: row.ownerAssignmentsJson ?? null,
    csOwnerAdminId: row.csOwnerAdminId || null,
    ownerAdminId: row.ownerAdminId || null,
    inputHash: row.inputHash || null,
    idempotencyKey: row.idempotencyKey || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeTrainingCurriculumVersion(row) {
  if (!row) return null;
  return {
    id: row.id,
    curriculumId: row.curriculumId || null,
    curriculumCode: row.curriculumCode || null,
    versionNumber: row.versionNumber ?? null,
    trainingType: row.trainingType || null,
    status: row.status || null,
    contentJson: row.contentJson ?? null,
    immutable: row.immutable === true,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeTrainingCohort(row) {
  if (!row) return null;
  return {
    id: row.id,
    cohortNumber: row.cohortNumber,
    programId: row.programId,
    name: row.name || null,
    language: row.language || null,
    deliveryMode: row.deliveryMode || null,
    timezone: row.timezone || null,
    capacity: row.capacity ?? null,
    status: row.status || TRAINING_COHORT_STATUS.DRAFT,
    idempotencyKey: row.idempotencyKey || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeTrainingParticipant(row) {
  if (!row) return null;
  return {
    id: row.id,
    programId: row.programId,
    contactId: row.contactId || null,
    tenantUserId: row.tenantUserId || null,
    identityType: row.identityType || null,
    identityKey: row.identityKey || null,
    verificationState:
      row.verificationState || TRAINING_PARTICIPANT_VERIFICATION.PENDING_VERIFICATION,
    customerId: row.customerId || null,
    tenantId: row.tenantId || null,
    businessId: row.businessId || null,
    branchId: row.branchId || null,
    trainingConsent:
      row.trainingConsent === true
        ? true
        : row.trainingConsent === false
          ? false
          : null,
    displayName: row.displayName || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeTrainingInvitation(row) {
  if (!row) return null;
  return {
    id: row.id,
    programId: row.programId,
    cohortId: row.cohortId || null,
    participantId: row.participantId || null,
    status: row.status || null,
    deliveryEvidenceJson: row.deliveryEvidenceJson ?? null,
    enrolmentId: row.enrolmentId || null,
    sentAt: row.sentAt ? new Date(row.sentAt).toISOString() : null,
    deliveredAt: row.deliveredAt ? new Date(row.deliveredAt).toISOString() : null,
    registeredAt: row.registeredAt
      ? new Date(row.registeredAt).toISOString()
      : null,
    idempotencyKey: row.idempotencyKey || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeTrainingEnrolment(row) {
  if (!row) return null;
  return {
    id: row.id,
    programId: row.programId,
    cohortId: row.cohortId,
    participantId: row.participantId,
    status: row.status || TRAINING_ENROLMENT_STATUS.ENROLLED,
    idempotencyKey: row.idempotencyKey || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeTrainingTrainer(row) {
  if (!row) return null;
  return {
    id: row.id,
    adminId: row.adminId || null,
    displayName: row.displayName || null,
    skillsJson: row.skillsJson ?? null,
    languagesJson: row.languagesJson ?? null,
    deliveryModesJson: row.deliveryModesJson ?? null,
    status: row.status || 'ACTIVE',
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeTrainingSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    sessionNumber: row.sessionNumber,
    programId: row.programId,
    cohortId: row.cohortId || null,
    crmMeetingId: row.crmMeetingId || null,
    timezone: row.timezone || null,
    startsAt: row.startsAt ? new Date(row.startsAt).toISOString() : null,
    endsAt: row.endsAt ? new Date(row.endsAt).toISOString() : null,
    status: row.status || TRAINING_SESSION_STATUS.DRAFT,
    conflictState: row.conflictState || null,
    sessionDelivered: row.sessionDelivered === true,
    idempotencyKey: row.idempotencyKey || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeTrainingAttendance(row) {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.sessionId,
    participantId: row.participantId,
    status: row.status || TRAINING_ATTENDANCE_STATUS.UNKNOWN,
    source: row.source || null,
    evidenceRef: row.evidenceRef || null,
    originalStatus: row.originalStatus || null,
    correctsAttendanceId: row.correctsAttendanceId || null,
    supersededById: row.supersededById || null,
    correctionReason: row.correctionReason || null,
    idempotencyKey: row.idempotencyKey || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeTrainingMaterial(row) {
  if (!row) return null;
  return {
    id: row.id,
    programId: row.programId,
    title: row.title || null,
    classification: row.classification || TRAINING_MATERIAL_CLASSIFICATION.INTERNAL,
    storageRef: row.storageRef || null,
    status: row.status || 'ACTIVE',
    contentJson: row.contentJson ?? null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/** Participant projection — never includes answer keys / marking keys. */
export function serializeTrainingMaterialForParticipant(row) {
  if (!row) return null;
  const base = serializeTrainingMaterial(row);
  const content =
    base.contentJson && typeof base.contentJson === 'object'
      ? { ...base.contentJson }
      : base.contentJson;
  if (content && typeof content === 'object') {
    delete content.answerKey;
    delete content.answerKeys;
    delete content.correctAnswers;
    delete content.correctAnswer;
    delete content.markingKey;
    delete content.solutionKey;
  }
  return {
    id: base.id,
    programId: base.programId,
    title: base.title,
    classification: base.classification,
    status: base.status,
    contentJson: content,
    // No storageRef / download URL in projection — download via reauth path only
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
  };
}

export function serializeTrainingExercise(row) {
  if (!row) return null;
  return {
    id: row.id,
    programId: row.programId,
    participantId: row.participantId,
    title: row.title || null,
    evidenceRef: row.evidenceRef || null,
    status: row.status || TRAINING_EXERCISE_STATUS.SUBMITTED,
    reviewDecision: row.reviewDecision || null,
    reviewReason: row.reviewReason || null,
    idempotencyKey: row.idempotencyKey || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeTrainingAssessment(row) {
  if (!row) return null;
  return {
    id: row.id,
    programId: row.programId,
    title: row.title || null,
    assessmentType: row.assessmentType || null,
    status: row.status || 'ACTIVE',
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeTrainingAssessmentVersion(row) {
  if (!row) return null;
  // Answer keys / questionsJson never projected — grading path loads server-side only.
  return {
    id: row.id,
    assessmentId: row.assessmentId,
    versionNumber: row.versionNumber ?? null,
    maxAttempts: row.maxAttempts ?? null,
    durationMinutes: row.durationMinutes ?? null,
    passScore: row.passScore ?? null,
    status: row.status || 'ACTIVE',
    immutable: row.immutable === true,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeTrainingAssessmentAttempt(row) {
  if (!row) return null;
  return {
    id: row.id,
    assessmentId: row.assessmentId,
    assessmentVersionId: row.assessmentVersionId,
    participantId: row.participantId,
    programId: row.programId || null,
    status: row.status || TRAINING_ATTEMPT_STATUS.IN_PROGRESS,
    attemptNumber: row.attemptNumber ?? null,
    serverStartedAt: row.serverStartedAt
      ? new Date(row.serverStartedAt).toISOString()
      : null,
    serverEndsAt: row.serverEndsAt ? new Date(row.serverEndsAt).toISOString() : null,
    submittedAt: row.submittedAt ? new Date(row.submittedAt).toISOString() : null,
    answersJson: row.answersJson ?? null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/** List projection — never includes answers. */
export function serializeTrainingAssessmentAttemptListItem(row) {
  if (!row) return null;
  const full = serializeTrainingAssessmentAttempt(row);
  const { answersJson: _omit, ...safe } = full;
  return safe;
}

export function serializeTrainingAssessmentResult(row) {
  if (!row) return null;
  return {
    id: row.id,
    attemptId: row.attemptId,
    assessmentVersionId: row.assessmentVersionId,
    participantId: row.participantId,
    programId: row.programId || null,
    score: row.score ?? null,
    originalScore: row.originalScore ?? null,
    passed: row.passed === true,
    gradeMode: row.gradeMode || null,
    status: row.status || TRAINING_RESULT_STATUS.PENDING,
    immutable: row.immutable === true,
    finalisedAt: row.finalisedAt ? new Date(row.finalisedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeTrainingAssessmentRegrade(row) {
  if (!row) return null;
  return {
    id: row.id,
    resultId: row.resultId,
    attemptId: row.attemptId || null,
    originalScore: row.originalScore ?? null,
    newScore: row.newScore ?? null,
    reason: row.reason || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

export function serializeTrainingParticipantCompletion(row) {
  if (!row) return null;
  return {
    id: row.id,
    programId: row.programId,
    participantId: row.participantId,
    policyVersion: row.policyVersion || null,
    status: row.status || TRAINING_COMPLETION_STATUS.UNKNOWN,
    gapsJson: row.gapsJson ?? null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeTrainingCertificate(row) {
  if (!row) return null;
  return {
    id: row.id,
    certificateNumber: row.certificateNumber,
    participantCompletionId: row.participantCompletionId,
    programId: row.programId || null,
    participantId: row.participantId || null,
    templateVersionId: row.templateVersionId || null,
    certificateType: row.certificateType || null,
    checksum: row.checksum || null,
    verificationCode: row.verificationCode || null,
    verificationStatus:
      row.verificationStatus || TRAINING_CERTIFICATE_VERIFICATION.UNKNOWN,
    status: row.status || null,
    revokeReason: row.revokeReason || null,
    revokeHistoryJson: row.revokeHistoryJson ?? null,
    idempotencyKey: row.idempotencyKey || null,
    issuedAt: row.issuedAt ? new Date(row.issuedAt).toISOString() : null,
    revokedAt: row.revokedAt ? new Date(row.revokedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/** Public-safe verification projection — limited fields. */
export function serializeTrainingCertificatePublic(row) {
  if (!row) return null;
  return {
    certificateNumber: row.certificateNumber,
    certificateType: row.certificateType || null,
    verificationStatus:
      row.verificationStatus || TRAINING_CERTIFICATE_VERIFICATION.UNKNOWN,
    issuedAt: row.issuedAt ? new Date(row.issuedAt).toISOString() : null,
    revokedAt: row.revokedAt ? new Date(row.revokedAt).toISOString() : null,
  };
}

export { getTrainingDomainContract };
