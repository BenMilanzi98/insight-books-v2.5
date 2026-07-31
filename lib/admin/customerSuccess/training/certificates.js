/**
 * Training Certificates — Phase 22 Wave 3 harden.
 * Eligibility UNKNOWN ≠ issue; checksum; idempotent; revoke preserves history.
 * Not professional accreditation.
 */

import { createHash, randomBytes } from 'crypto';
import {
  TRAINING_CERTIFICATE_ELIGIBILITY,
  TRAINING_CERTIFICATE_TYPE,
  TRAINING_CERTIFICATE_VERIFICATION,
  TRAINING_COMPLETION_STATUS,
  getTrainingDomainContract,
} from './catalogue.js';
import { allocateTrainingCertificateNumber } from './numbering.js';
import {
  canManageTraining,
  canViewTraining,
  hasCustomerTrainingCertificateModel,
  hasCustomerTrainingParticipantCompletionModel,
  resolveTrainingActor,
  serializeTrainingCertificate,
  serializeTrainingCertificatePublic,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';

function computeChecksum(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Deterministic eligibility from completion row / status.
 * UNKNOWN must never be treated as ELIGIBLE.
 */
export function evaluateCertificateEligibility(completionOrStatus) {
  if (completionOrStatus == null) {
    return TRAINING_CERTIFICATE_ELIGIBILITY.UNKNOWN;
  }
  const status =
    typeof completionOrStatus === 'string'
      ? String(completionOrStatus).trim().toUpperCase()
      : String(completionOrStatus.status || '').trim().toUpperCase();

  if (!status || status === TRAINING_COMPLETION_STATUS.UNKNOWN) {
    return TRAINING_CERTIFICATE_ELIGIBILITY.UNKNOWN;
  }
  if (status === TRAINING_COMPLETION_STATUS.COMPLETED) {
    return TRAINING_CERTIFICATE_ELIGIBILITY.ELIGIBLE;
  }
  if (
    status === TRAINING_COMPLETION_STATUS.COMPLETED_WITH_GAPS ||
    status === TRAINING_COMPLETION_STATUS.NOT_COMPLETED ||
    status === TRAINING_COMPLETION_STATUS.IN_PROGRESS
  ) {
    return TRAINING_CERTIFICATE_ELIGIBILITY.INELIGIBLE;
  }
  return TRAINING_CERTIFICATE_ELIGIBILITY.UNKNOWN;
}

export async function issueTrainingCertificate(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_certificate_issue_forbidden' };
  }
  if (!hasCustomerTrainingCertificateModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_certificate_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCustomerTrainingParticipantCompletionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_participant_completion_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const participantCompletionId = args.participantCompletionId
    ? String(args.participantCompletionId).trim()
    : '';
  const templateVersionId = args.templateVersionId
    ? String(args.templateVersionId).trim()
    : '';
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  const certificateType = String(
    args.certificateType || TRAINING_CERTIFICATE_TYPE.COMPLETION
  )
    .trim()
    .toUpperCase();

  if (!participantCompletionId) {
    return { ok: false, error: 'participantCompletionId_required' };
  }
  if (!templateVersionId) return { ok: false, error: 'templateVersionId_required' };
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  // Explicit UNKNOWN eligibility pin — refuse before lookup.
  const forcedEligibility = args.eligibilityStatus
    ? String(args.eligibilityStatus).trim().toUpperCase()
    : null;
  if (forcedEligibility === TRAINING_CERTIFICATE_ELIGIBILITY.UNKNOWN) {
    return {
      ok: false,
      error: 'certificate_eligibility_UNKNOWN_cannot_issue',
      eligibility: TRAINING_CERTIFICATE_ELIGIBILITY.UNKNOWN,
    };
  }

  const existing = await prisma.customerTrainingCertificate.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    if (String(existing.participantCompletionId) !== participantCompletionId) {
      return {
        ok: false,
        error: 'idempotency_conflict',
        field: 'participantCompletionId',
      };
    }
    if (
      existing.templateVersionId != null &&
      String(existing.templateVersionId) !== templateVersionId
    ) {
      return {
        ok: false,
        error: 'idempotency_conflict',
        field: 'templateVersionId',
      };
    }
    return {
      ok: true,
      certificate: serializeTrainingCertificate(existing),
      alreadyExists: true,
      idempotentReplay: true,
      domain: getTrainingDomainContract(),
    };
  }

  const completion = await prisma.customerTrainingParticipantCompletion.findUnique({
    where: { id: participantCompletionId },
  });
  if (!completion) {
    return {
      ok: false,
      error: 'completion_required_or_not_found',
      notFound: true,
      eligibility: TRAINING_CERTIFICATE_ELIGIBILITY.UNKNOWN,
    };
  }

  const eligibility = evaluateCertificateEligibility(completion);
  if (eligibility === TRAINING_CERTIFICATE_ELIGIBILITY.UNKNOWN) {
    return {
      ok: false,
      error: 'certificate_eligibility_UNKNOWN_cannot_issue',
      eligibility,
      status: completion.status,
    };
  }
  if (eligibility !== TRAINING_CERTIFICATE_ELIGIBILITY.ELIGIBLE) {
    return {
      ok: false,
      error: 'completion_required_not_completed',
      status: completion.status,
      eligibility,
    };
  }
  if (completion.status !== TRAINING_COMPLETION_STATUS.COMPLETED) {
    return {
      ok: false,
      error: 'completion_required_not_completed',
      status: completion.status,
      eligibility,
    };
  }

  const access = await loadTrainingProgramForActor(prisma, {
    ...args,
    programId: completion.programId,
  });
  if (!access.ok) return access;

  const now = args.now || new Date();
  const allocated = await allocateTrainingCertificateNumber(prisma, { now });
  if (!allocated.ok) {
    return { ok: false, error: allocated.error || 'certificate_number_allocation_failed' };
  }

  const verificationCode = randomBytes(16).toString('hex');
  const checksum = computeChecksum({
    certificateNumber: allocated.number,
    participantCompletionId,
    templateVersionId,
    certificateType,
    participantId: completion.participantId,
    programId: completion.programId,
    issuedAt: now.toISOString(),
  });

  const certificate = await prisma.customerTrainingCertificate.create({
    data: {
      certificateNumber: allocated.number,
      participantCompletionId,
      programId: completion.programId,
      participantId: completion.participantId,
      templateVersionId,
      certificateType,
      checksum,
      verificationCode,
      verificationStatus: TRAINING_CERTIFICATE_VERIFICATION.VALID,
      status: 'ISSUED',
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      issuedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    certificate: serializeTrainingCertificate(certificate),
    created: true,
    domain: getTrainingDomainContract(),
  };
}

export async function revokeTrainingCertificate(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_certificate_revoke_forbidden' };
  }
  if (!hasCustomerTrainingCertificateModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_certificate_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const certificateId = args.certificateId ? String(args.certificateId).trim() : '';
  const reason = args.reason ? String(args.reason).trim() : '';
  if (!certificateId) return { ok: false, error: 'certificateId_required' };
  if (!reason) return { ok: false, error: 'reason_required' };

  const certificate = await prisma.customerTrainingCertificate.findUnique({
    where: { id: certificateId },
  });
  if (!certificate) {
    return { ok: false, notFound: true, error: 'certificate_not_found' };
  }

  if (certificate.programId) {
    const access = await loadTrainingProgramForActor(prisma, {
      ...args,
      programId: certificate.programId,
    });
    if (!access.ok) return access;
  }

  const now = args.now || new Date();
  const priorHistory = Array.isArray(certificate.revokeHistoryJson)
    ? [...certificate.revokeHistoryJson]
    : [];
  const historyEntry = {
    event: 'REVOKED',
    at: now.toISOString(),
    reason,
    byAdminId: admin?.id || null,
    prior: {
      verificationStatus: certificate.verificationStatus,
      status: certificate.status,
      checksum: certificate.checksum,
      certificateNumber: certificate.certificateNumber,
      issuedAt: certificate.issuedAt
        ? new Date(certificate.issuedAt).toISOString()
        : null,
      participantCompletionId: certificate.participantCompletionId,
    },
  };
  priorHistory.push(historyEntry);

  const updated = await prisma.customerTrainingCertificate.update({
    where: { id: certificateId },
    data: {
      verificationStatus: TRAINING_CERTIFICATE_VERIFICATION.REVOKED,
      status: 'REVOKED',
      revokeReason: reason,
      revokedAt: now,
      revokedByAdminId: admin?.id || null,
      revokeHistoryJson: priorHistory,
      // Preserve identity fields — never clear checksum / number / issuedAt.
      updatedAt: now,
    },
  });

  return {
    ok: true,
    certificate: serializeTrainingCertificate(updated),
    historyPreserved: true,
    revokeHistory: priorHistory,
    domain: getTrainingDomainContract(),
  };
}

export async function verifyTrainingCertificate(prisma, args = {}) {
  if (!hasCustomerTrainingCertificateModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_certificate_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const verificationCode = args.verificationCode
    ? String(args.verificationCode).trim()
    : '';
  const certificateNumber = args.certificateNumber
    ? String(args.certificateNumber).trim()
    : '';

  if (!verificationCode && !certificateNumber) {
    return { ok: false, error: 'verificationCode_or_certificateNumber_required' };
  }

  let certificate = null;
  if (verificationCode) {
    certificate = await prisma.customerTrainingCertificate.findUnique({
      where: { verificationCode },
    });
  }
  if (!certificate && certificateNumber) {
    certificate = await prisma.customerTrainingCertificate.findUnique({
      where: { certificateNumber },
    });
  }
  if (!certificate) {
    return {
      ok: false,
      notFound: true,
      error: 'certificate_not_found',
      verificationStatus: TRAINING_CERTIFICATE_VERIFICATION.UNKNOWN,
    };
  }

  const verificationStatus =
    certificate.verificationStatus || TRAINING_CERTIFICATE_VERIFICATION.UNKNOWN;

  return {
    ok: true,
    verificationStatus,
    status: verificationStatus,
    certificate: serializeTrainingCertificatePublic(certificate),
    domain: getTrainingDomainContract(),
  };
}

export { canViewTraining };
