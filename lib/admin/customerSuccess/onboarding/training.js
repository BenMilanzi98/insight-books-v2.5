/**
 * Training coordination + Phase 22 Training handoff emit — Phase 21 Wave 3.
 * COMPLETED requires Training-domain source. Emit handoff only — never create
 * Programs / Sessions / attendance / certificates (FUTURE PRD 22 / tree-18).
 */

import { createHash } from 'crypto';
import { loadOnboardingProjectForActor } from './projectAccess.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingTrainingModel,
  hasCustomerOnboardingPhase22TrainingHandoffModel,
  serializeOnboardingTraining,
  serializePhase22TrainingHandoff,
} from './model.js';
import {
  getOnboardingDomainContract,
  PHASE22_TRAINING_HANDOFF_STATUS,
} from './catalogue.js';

export const TRAINING_COORD_STATUS = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

const TRAINING_DOMAIN_SOURCES = new Set([
  'PHASE_18_TRAINING',
  'PHASE_18',
  'PHASE_22_TRAINING',
  'PHASE_22',
  'TRAINING_DOMAIN',
  'CUSTOMER_TRAINING',
]);

/**
 * Pure refuse — Phase 21 must never create Training delivery artifacts.
 */
export function refusePhase22TrainingDelivery(args = {}) {
  if (
    args.createProgram === true ||
    args.createSession === true ||
    args.createAttendance === true ||
    args.createCertificate === true ||
    args.createTrainer === true
  ) {
    return {
      ok: false,
      error: 'phase_22_training_delivery_forbidden',
      hint: 'Phase 21 emits Training handoff only — Programs/Sessions/attendance/certs are FUTURE PRD 22',
    };
  }
  return {
    ok: true,
    createsPrograms: false,
    createsSessions: false,
    createsAttendance: false,
    createsCertificates: false,
  };
}

export function computePhase22TrainingHandoffChecksum(payload = {}) {
  const canonical = {
    type: payload.type || 'ONBOARDING_PHASE_22_TRAINING_HANDOFF',
    projectId: payload.projectId || null,
    customerId: payload.customerId || null,
    tenantId: payload.tenantId || null,
    subscriptionId: payload.subscriptionId || null,
    products: payload.products || null,
    modules: payload.modules || null,
    roles: payload.roles || null,
    participants: payload.participants || null,
    contacts: payload.contacts || null,
    language: payload.language || null,
    deliveryPreference: payload.deliveryPreference || null,
    dates: payload.dates || null,
    goLiveDependency: payload.goLiveDependency === true,
    commercialInclusion: payload.commercialInclusion === true,
    risks: payload.risks || null,
    watermark: payload.watermark || 'PHASE_21_TO_PHASE_22_TRAINING_HANDOFF',
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export async function setTrainingCoordinationStatus(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;
  if (!canManageOnboarding(loaded.admin)) {
    return { ok: false, forbidden: true, error: 'onboarding_training_forbidden' };
  }
  if (!hasCustomerOnboardingTrainingModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_training_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const status = String(args.status || TRAINING_COORD_STATUS.UNKNOWN)
    .trim()
    .toUpperCase();

  const trainingDomainSource = args.trainingDomainSource
    ? String(args.trainingDomainSource).trim().toUpperCase()
    : null;
  const trainingDomainStatus = args.trainingDomainStatus
    ? String(args.trainingDomainStatus).trim().toUpperCase()
    : null;

  if (status === TRAINING_COORD_STATUS.COMPLETED) {
    const hasSource =
      trainingDomainSource &&
      TRAINING_DOMAIN_SOURCES.has(trainingDomainSource) &&
      trainingDomainStatus === 'COMPLETED';
    if (!hasSource) {
      return {
        ok: false,
        error: 'training_completed_requires_training_domain_source',
        hint: 'Phase 22 Training domain must declare COMPLETED (coordination alone insufficient)',
      };
    }
  }

  const now = args.now || new Date();
  const existing = await prisma.customerOnboardingTraining.findFirst({
    where: { projectId: loaded.project.id },
  });

  const data = {
    projectId: loaded.project.id,
    status,
    sourceDomain:
      args.sourceDomain || existing?.sourceDomain || 'PHASE_16_TRAINING_HANDOFF',
    trainingDomainSource:
      trainingDomainSource || existing?.trainingDomainSource || null,
    trainingDomainStatus:
      trainingDomainStatus || existing?.trainingDomainStatus || 'UNKNOWN',
    updatedAt: now,
  };

  const row = existing
    ? await prisma.customerOnboardingTraining.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.customerOnboardingTraining.create({
        data: {
          ...data,
          createdByAdminId: loaded.admin?.id || null,
          createdAt: now,
        },
      });

  return {
    ok: true,
    training: serializeOnboardingTraining(row),
    domain: getOnboardingDomainContract(),
  };
}

/**
 * Emit Phase 22 Training handoff package — checksum + idempotent.
 * Never creates Programs, Sessions, attendance, or certificates.
 */
export async function emitPhase22TrainingHandoff(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;
  if (!canManageOnboarding(loaded.admin)) {
    return { ok: false, forbidden: true, error: 'onboarding_training_forbidden' };
  }

  const delivery = refusePhase22TrainingDelivery(args);
  if (!delivery.ok) return delivery;

  if (!hasCustomerOnboardingPhase22TrainingHandoffModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_phase22_training_handoff_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!idempotencyKey) {
    return { ok: false, error: 'idempotencyKey_required' };
  }

  const existing = await prisma.customerOnboardingPhase22TrainingHandoff.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    if (existing.projectId !== loaded.project.id) {
      return { ok: false, error: 'idempotency_conflict' };
    }
    return {
      ok: true,
      alreadyExists: true,
      idempotentReplay: true,
      handoff: serializePhase22TrainingHandoff(existing),
      payload: existing.payloadJson || null,
      created: false,
      meta: {
        createsPrograms: false,
        createsSessions: false,
        createsAttendance: false,
        createsCertificates: false,
        futurePhase: 22,
      },
    };
  }

  const payload = {
    type: 'ONBOARDING_PHASE_22_TRAINING_HANDOFF',
    projectId: loaded.project.id,
    customerId: loaded.project.customerId || null,
    tenantId: loaded.project.tenantId || null,
    subscriptionId: loaded.project.subscriptionId || null,
    products: args.products || null,
    modules: args.modules || null,
    roles: args.roles || null,
    participants: args.participants || null,
    contacts: args.contacts || null,
    language: args.language || 'en',
    deliveryPreference: args.deliveryPreference || null,
    dates: args.dates || null,
    goLiveDependency: args.goLiveDependency !== false,
    commercialInclusion: args.commercialInclusion === true,
    risks: args.risks || null,
    watermark: 'PHASE_21_TO_PHASE_22_TRAINING_HANDOFF',
    trainingCompleted: false,
    fabricatedComplete: false,
    createsPrograms: false,
    createsSessions: false,
    createsAttendance: false,
    createsCertificates: false,
  };

  const checksumSha256 = computePhase22TrainingHandoffChecksum(payload);
  const now = args.now || new Date();
  const status = String(args.status || PHASE22_TRAINING_HANDOFF_STATUS.READY)
    .trim()
    .toUpperCase();

  const row = await prisma.customerOnboardingPhase22TrainingHandoff.create({
    data: {
      projectId: loaded.project.id,
      status,
      payloadJson: payload,
      checksumSha256,
      idempotencyKey,
      createdByAdminId: loaded.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  // Hard refuse any Training delivery side-effects even if models are present.
  if (typeof prisma.customerTrainingProgram?.create === 'function') {
    /* never call */
  }
  if (typeof prisma.customerTrainingSession?.create === 'function') {
    /* never call */
  }

  return {
    ok: true,
    created: true,
    handoff: serializePhase22TrainingHandoff(row),
    payload,
    domain: getOnboardingDomainContract(),
    meta: {
      createsPrograms: false,
      createsSessions: false,
      createsAttendance: false,
      createsCertificates: false,
      futurePhase: 22,
    },
  };
}
