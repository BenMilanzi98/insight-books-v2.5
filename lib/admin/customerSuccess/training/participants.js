/**
 * Training Participants — Phase 22 Wave 2.
 * Verify identity; dedupe; Customer/Tenant/Business/Branch scope;
 * consent ≠ Marketing consent; PII-safe projections.
 */

import {
  TRAINING_PARTICIPANT_VERIFICATION,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canManageTraining,
  hasCustomerTrainingParticipantModel,
  hasCustomerTrainingProgramModel,
  resolveTrainingActor,
  serializeTrainingParticipant,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';

function buildIdentityKey({ identityType, contactId, tenantUserId, externalId }) {
  const type = String(identityType || 'CUSTOMER_CONTACT').trim().toUpperCase();
  if (contactId) return `${type}:contact:${String(contactId).trim()}`;
  if (tenantUserId) return `${type}:tenantUser:${String(tenantUserId).trim()}`;
  if (externalId) return `${type}:external:${String(externalId).trim()}`;
  return null;
}

/**
 * Participant projection — never implies Marketing consent equivalence.
 */
export function projectTrainingParticipant(participant) {
  if (!participant) return null;
  const base = serializeTrainingParticipant(participant);
  return {
    ...base,
    consentEqualsMarketingConsent: false,
    trainingConsent:
      participant.trainingConsent === true ||
      participant.consentJson?.training === true ||
      null,
    // Explicitly omit marketingConsent from Participant projections
  };
}

/**
 * Verify / register a Participant against a Program. Duplicate identity blocked.
 */
export async function verifyTrainingParticipant(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_participant_verify_forbidden' };
  }
  if (!hasCustomerTrainingParticipantModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_participant_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const programId = args.programId ? String(args.programId).trim() : '';
  if (!programId) return { ok: false, error: 'programId_required' };

  const access = await loadTrainingProgramForActor(prisma, { ...args, programId });
  if (!access.ok) return access;

  const contactId = args.contactId ? String(args.contactId).trim() : null;
  const tenantUserId = args.tenantUserId ? String(args.tenantUserId).trim() : null;
  const externalId = args.externalId ? String(args.externalId).trim() : null;
  const identityType = String(args.identityType || 'CUSTOMER_CONTACT')
    .trim()
    .toUpperCase();
  const identityKey = buildIdentityKey({
    identityType,
    contactId,
    tenantUserId,
    externalId,
  });
  if (!identityKey) {
    return { ok: false, error: 'identity_required' };
  }

  if (hasCustomerTrainingProgramModel(prisma) && !access.programRow && !access.program) {
    return { ok: false, error: 'program_not_found', notFound: true };
  }

  const programRow = access.programRow || access.program || {};
  const customerId =
    args.customerId != null
      ? String(args.customerId).trim()
      : programRow.customerId
        ? String(programRow.customerId).trim()
        : null;
  const tenantId =
    args.tenantId != null
      ? String(args.tenantId).trim()
      : programRow.tenantId
        ? String(programRow.tenantId).trim()
        : null;
  const businessId = args.businessId ? String(args.businessId).trim() : null;
  const branchId = args.branchId ? String(args.branchId).trim() : null;

  if (
    args.customerId &&
    programRow.customerId &&
    String(args.customerId).trim() !== String(programRow.customerId).trim()
  ) {
    return { ok: false, error: 'participant_customer_scope_mismatch' };
  }
  if (
    args.tenantId &&
    programRow.tenantId &&
    String(args.tenantId).trim() !== String(programRow.tenantId).trim()
  ) {
    return { ok: false, error: 'participant_tenant_scope_mismatch' };
  }

  const existing = await prisma.customerTrainingParticipant.findFirst({
    where: { programId, identityKey },
  });
  if (existing) {
    const idempotencyKey = args.idempotencyKey
      ? String(args.idempotencyKey).trim()
      : '';
    if (idempotencyKey && existing.idempotencyKey === idempotencyKey) {
      return {
        ok: true,
        participant: serializeTrainingParticipant(existing),
        alreadyExists: true,
        idempotentReplay: true,
        domain: getTrainingDomainContract(),
      };
    }
    return {
      ok: false,
      error: 'duplicate_identity',
      existingParticipantId: existing.id,
      identityKey,
    };
  }

  const verificationState = String(
    args.verificationState || TRAINING_PARTICIPANT_VERIFICATION.PENDING_VERIFICATION
  )
    .trim()
    .toUpperCase();
  const allowed = new Set(Object.values(TRAINING_PARTICIPANT_VERIFICATION));
  if (!allowed.has(verificationState)) {
    return { ok: false, error: 'invalid_verification_state' };
  }

  const now = args.now || new Date();
  const participant = await prisma.customerTrainingParticipant.create({
    data: {
      programId,
      contactId,
      tenantUserId,
      externalId,
      identityType,
      identityKey,
      verificationState,
      customerId,
      tenantId,
      businessId,
      branchId,
      trainingConsent:
        args.trainingConsent === true
          ? true
          : args.trainingConsent === false
            ? false
            : null,
      displayName: args.displayName ? String(args.displayName).trim() : null,
      idempotencyKey: args.idempotencyKey
        ? String(args.idempotencyKey).trim()
        : null,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    participant: serializeTrainingParticipant(participant),
    created: true,
    domain: getTrainingDomainContract(),
  };
}
