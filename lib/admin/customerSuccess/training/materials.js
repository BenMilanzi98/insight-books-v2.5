/**
 * Training materials classification + private download boundary — Phase 22 Wave 2.
 * UNKNOWN Participants denied RESTRICTED materials.
 * Restricted download requires reauthorisation; answer keys never in Participant projections.
 */

import {
  TRAINING_MATERIAL_CLASSIFICATION,
  TRAINING_PARTICIPANT_VERIFICATION,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canManageTraining,
  canViewTraining,
  hasCustomerTrainingMaterialModel,
  hasCustomerTrainingParticipantModel,
  resolveTrainingActor,
  serializeTrainingMaterial,
  serializeTrainingMaterialForParticipant,
} from './model.js';

const ANSWER_KEY_FIELDS = new Set([
  'answerKey',
  'answerKeys',
  'correctAnswers',
  'correctAnswer',
  'markingKey',
  'solutionKey',
]);

function stripAnswerKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map((v) => stripAnswerKeysDeep(v));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (ANSWER_KEY_FIELDS.has(k)) continue;
      out[k] = stripAnswerKeysDeep(v);
    }
    return out;
  }
  return value;
}

/**
 * Participant-safe material projection — strips answer keys / marking keys.
 */
export function projectMaterialForParticipant(material) {
  if (!material) return null;
  const base = serializeTrainingMaterialForParticipant(material);
  if (base?.contentJson) {
    base.contentJson = stripAnswerKeysDeep(base.contentJson);
  }
  delete base.answerKey;
  delete base.answerKeys;
  delete base.correctAnswers;
  return base;
}

/**
 * Assert Participant may access a material (RESTRICTED requires VERIFIED + reauth).
 */
export async function assertRestrictedMaterialAccess(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canViewTraining(admin) && !canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_material_access_forbidden' };
  }
  if (!hasCustomerTrainingMaterialModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_material_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCustomerTrainingParticipantModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_participant_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const materialId = args.materialId ? String(args.materialId).trim() : '';
  const participantId = args.participantId ? String(args.participantId).trim() : '';
  if (!materialId) return { ok: false, error: 'materialId_required' };
  if (!participantId) return { ok: false, error: 'participantId_required' };

  const material = await prisma.customerTrainingMaterial.findUnique({
    where: { id: materialId },
  }).catch(async () =>
    prisma.customerTrainingMaterial.findFirst({ where: { id: materialId } })
  );
  if (!material) return { ok: false, error: 'material_not_found', notFound: true };

  const participant = await prisma.customerTrainingParticipant.findUnique({
    where: { id: participantId },
  });
  if (!participant) return { ok: false, error: 'participant_not_found', notFound: true };

  const classification = String(material.classification || '')
    .trim()
    .toUpperCase();
  const verification = String(participant.verificationState || '')
    .trim()
    .toUpperCase();

  if (
    classification === TRAINING_MATERIAL_CLASSIFICATION.RESTRICTED &&
    verification !== TRAINING_PARTICIPANT_VERIFICATION.VERIFIED
  ) {
    return {
      ok: false,
      error: 'restricted_material_denied_for_UNKNOWN_or_unverified',
      verificationState: verification,
      classification,
      downloadUrl: null,
      material: projectMaterialForParticipant(material),
      domain: getTrainingDomainContract(),
    };
  }

  if (classification === TRAINING_MATERIAL_CLASSIFICATION.RESTRICTED) {
    const reauthToken = args.downloadReauthToken
      ? String(args.downloadReauthToken).trim()
      : '';
    const reauthorisedAt = args.reauthorisedAt
      ? String(args.reauthorisedAt).trim()
      : '';
    if (!reauthToken || !reauthorisedAt) {
      return {
        ok: false,
        error: 'restricted_material_reauth_required',
        downloadUrl: null,
        material: projectMaterialForParticipant(material),
        domain: getTrainingDomainContract(),
      };
    }
  }

  const downloadUrl =
    classification === TRAINING_MATERIAL_CLASSIFICATION.RESTRICTED
      ? `private://training/download/${material.id}`
      : material.storageRef || null;

  return {
    ok: true,
    material: projectMaterialForParticipant(material),
    participant: {
      id: participant.id,
      verificationState: verification,
    },
    downloadUrl,
    privateBoundary: classification !== TRAINING_MATERIAL_CLASSIFICATION.PUBLIC,
    reauthorised: classification === TRAINING_MATERIAL_CLASSIFICATION.RESTRICTED,
    domain: getTrainingDomainContract(),
  };
}

export { serializeTrainingMaterial };
