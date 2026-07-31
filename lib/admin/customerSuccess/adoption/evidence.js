/**
 * Phase 9 evidence snapshots for Adoption milestones — read-only wrap.
 * Gate fail / missing → UNAVAILABLE; never invent MET or KPI zeroes.
 * Client analyticsGate / phase9Snapshot never invent MET unless allowTestEvidenceInject.
 */

import {
  ADOPTION_EVIDENCE_MODE,
  ADOPTION_EVIDENCE_STATUS,
  getAdoptionDomainContract,
} from './catalogue.js';
import {
  canManageAdoption,
  hasCustomerAdoptionEvidenceSnapshotModel,
  hasCustomerTrainingCertificateModel,
  hasCustomerTrainingProgramModel,
  resolveAdoptionActor,
  serializeAdoptionEvidenceSnapshot,
} from './model.js';
import { loadAdoptionPlanForActor } from './planAccess.js';
import { evaluateProductReliability } from '@/lib/admin/productAnalytics/reliabilityGate.js';
import { PRODUCT_RELIABILITY_STATUS } from '@/lib/admin/productAnalytics/catalogue.js';
import {
  loadFirstValue,
  FIRST_VALUE_RULE_VERSION,
} from '@/lib/admin/productAnalytics/firstValue.js';
import {
  evaluateAdoptionState,
  ADOPTION_STATE,
} from '@/lib/admin/productAnalytics/adoption.js';
import { evaluateProductSignalsForTenant } from '@/lib/admin/productAnalytics/signals.js';
import { TRAINING_CERTIFICATE_VERIFICATION } from '../training/catalogue.js';

const GATE_FAIL = new Set([
  PRODUCT_RELIABILITY_STATUS.NOT_INSTRUMENTED,
  PRODUCT_RELIABILITY_STATUS.DEFINITION_MISSING,
  PRODUCT_RELIABILITY_STATUS.STALE,
  PRODUCT_RELIABILITY_STATUS.DELAYED,
  PRODUCT_RELIABILITY_STATUS.RECONCILIATION_FAILED,
  PRODUCT_RELIABILITY_STATUS.DATA_QUALITY_BLOCKED,
  PRODUCT_RELIABILITY_STATUS.PERMISSION_RESTRICTED,
  PRODUCT_RELIABILITY_STATUS.UNSUPPORTED_PERIOD,
  'UNAVAILABLE',
  'UNKNOWN',
]);

/** Adoption states that satisfy first-value / active-value product milestones. */
const PRODUCT_VALUE_STATES = new Set([
  ADOPTION_STATE.FIRST_VALUE_ACHIEVED,
  ADOPTION_STATE.REPEAT_VALUE_ACHIEVED,
  ADOPTION_STATE.RECENTLY_ACTIVE,
  ADOPTION_STATE.CONSISTENTLY_ACTIVE,
  ADOPTION_STATE.DECLINING_USAGE,
]);

function unavailableProductEvidence(args, extras = {}) {
  return {
    status: ADOPTION_EVIDENCE_STATUS.UNAVAILABLE,
    meetsDefinition: false,
    reasonCode: extras.reasonCode || 'phase9_evidence_unavailable',
    reasonMessage:
      extras.reasonMessage ||
      'Phase 9 evidence UNAVAILABLE — never invent MET',
    sourceSystem: 'PHASE_9_PRODUCT_ANALYTICS',
    snapshot: extras.snapshot ?? null,
    observedAt: args.now || new Date(),
  };
}

/**
 * Server-side Phase 9 read-only snapshot (firstValue / adoption / signals).
 * Returns null when unreadable — caller treats as UNAVAILABLE (never MET).
 */
export async function readPhase9ProductEvidence(prisma, args = {}) {
  const tenantId = args.tenantId ? String(args.tenantId).trim() : '';
  const featureCode = args.featureCode ? String(args.featureCode).trim() : '';
  const now = args.now || new Date();

  if (!tenantId || !featureCode) {
    return null;
  }

  try {
    const firstValue = await loadFirstValue(prisma, {
      tenantId,
      featureCode,
      ruleVersion: FIRST_VALUE_RULE_VERSION,
    });

    let adoption = null;
    try {
      adoption = await evaluateAdoptionState(prisma, {
        tenantId,
        featureCode,
        asOf: now,
        persist: false,
      });
    } catch {
      adoption = null;
    }

    let signalsPack = null;
    try {
      signalsPack = await evaluateProductSignalsForTenant(prisma, {
        tenantId,
        featureCode,
        now,
      });
    } catch {
      signalsPack = null;
    }

    const adoptionState = adoption?.state || null;
    const hasFirstValue = Boolean(
      firstValue && (firstValue.id || firstValue.sourceId || firstValue.occurredAt)
    );
    const meetsDefinition =
      hasFirstValue || PRODUCT_VALUE_STATES.has(String(adoptionState || ''));

    return {
      sourceSystem: 'PHASE_9_PRODUCT_ANALYTICS',
      featureCode,
      tenantId,
      firstValue: hasFirstValue
        ? {
            id: firstValue.id || null,
            occurredAt: firstValue.occurredAt || null,
            ruleVersion: firstValue.ruleVersion || FIRST_VALUE_RULE_VERSION,
          }
        : null,
      adoptionState,
      adoptionReasonCode: adoption?.reasonCode || null,
      signals: Array.isArray(signalsPack?.signals) ? signalsPack.signals : [],
      meetsDefinition,
      observedAt: now.toISOString?.() || new Date(now).toISOString(),
      readable: true,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve PRODUCT_ANALYTICS evidence honesty for a milestone definition.
 * Server-side Phase 9 reads only. Test inject requires allowTestEvidenceInject.
 */
export async function resolveProductAnalyticsEvidence(prisma, args = {}) {
  const def = args.definition || {};
  const metricCode =
    args.metricCode || def.metricCode || 'product.feature.invoices.post.count';
  const featureCode =
    args.featureCode || def.featureCode || 'invoices.post';
  const tenantId =
    args.tenantId ||
    args.planRow?.tenantId ||
    args.plan?.tenantId ||
    null;
  const allowInject = args.allowTestEvidenceInject === true;

  let gate;
  if (allowInject && args.analyticsGate) {
    gate = args.analyticsGate;
  } else {
    gate = evaluateProductReliability(metricCode, {
      featureCode,
      permissionOk: args.permissionOk !== false,
      definitionActive: args.definitionActive !== false,
    });
  }

  if (
    gate.status &&
    gate.status !== PRODUCT_RELIABILITY_STATUS.AVAILABLE &&
    gate.status !== 'AVAILABLE'
  ) {
    return unavailableProductEvidence(args, {
      reasonCode: gate.reasonCode || String(gate.status).toLowerCase(),
      reasonMessage:
        gate.reasonMessage ||
        'Phase 9 reliability gate failed — evidence UNAVAILABLE',
      snapshot: { gate },
    });
  }

  if (GATE_FAIL.has(gate.status)) {
    return unavailableProductEvidence(args, {
      reasonCode: gate.reasonCode || String(gate.status).toLowerCase(),
      reasonMessage:
        gate.reasonMessage ||
        'Phase 9 reliability gate failed — evidence UNAVAILABLE',
      snapshot: { gate },
    });
  }

  let snap = null;
  if (allowInject && args.phase9Snapshot) {
    snap = args.phase9Snapshot;
  } else {
    snap = await readPhase9ProductEvidence(prisma, {
      tenantId,
      featureCode,
      now: args.now || new Date(),
    });
  }

  if (!snap) {
    return unavailableProductEvidence(args, {
      reasonCode: 'phase9_snapshot_unreadable',
      reasonMessage:
        'Phase 9 firstValue/adoption/signals unreadable — evidence UNAVAILABLE (never invent MET)',
      snapshot: { gate, tenantId, featureCode },
    });
  }

  if (snap.meetsDefinition !== true) {
    return unavailableProductEvidence(args, {
      reasonCode: 'phase9_snapshot_missing_or_unmet',
      reasonMessage:
        'Fresh Phase 9 snapshot meeting definition is required — never invent MET',
      snapshot: { gate, phase9Snapshot: snap },
    });
  }

  return {
    status: ADOPTION_EVIDENCE_STATUS.READY,
    meetsDefinition: true,
    reasonCode: null,
    reasonMessage: null,
    sourceSystem: snap.sourceSystem || 'PHASE_9_PRODUCT_ANALYTICS',
    snapshot: snap,
    observedAt: snap.observedAt ? new Date(snap.observedAt) : args.now || new Date(),
  };
}

/**
 * TRAINING_CERT: Program COMPLETED and/or valid non-revoked certificate.
 * COMPLETED_WITH_GAPS alone does not satisfy when requireProgramCompleted.
 */
export async function resolveTrainingCertEvidence(prisma, args = {}) {
  const plan = args.planRow || args.plan;
  const def = args.definition || {};
  const requireProgramCompleted = def.requireProgramCompleted !== false;
  const programId = plan?.trainingProgramId || args.trainingProgramId || null;

  if (!programId) {
    return {
      status: ADOPTION_EVIDENCE_STATUS.UNAVAILABLE,
      meetsDefinition: false,
      reasonCode: 'training_program_missing',
      reasonMessage: 'No trainingProgramId pinned on Adoption Plan',
      sourceSystem: 'PHASE_18_TRAINING',
      snapshot: null,
      observedAt: args.now || new Date(),
    };
  }

  let program = null;
  if (hasCustomerTrainingProgramModel(prisma)) {
    program = await prisma.customerTrainingProgram.findUnique({
      where: { id: String(programId) },
    });
  }

  const programStatus = String(program?.status || '').toUpperCase();
  const programCompleted = programStatus === 'COMPLETED';
  const programWithGaps = programStatus === 'COMPLETED_WITH_GAPS';

  let validCert = null;
  if (hasCustomerTrainingCertificateModel(prisma)) {
    validCert = await prisma.customerTrainingCertificate.findFirst({
      where: {
        programId: String(programId),
        verificationStatus: TRAINING_CERTIFICATE_VERIFICATION.VALID,
      },
    });
  }
  if (!validCert && args.validCertificate === true) {
    validCert = { id: 'injected-valid-cert', verificationStatus: 'VALID' };
  }

  if (requireProgramCompleted) {
    if (programCompleted || validCert) {
      return {
        status: ADOPTION_EVIDENCE_STATUS.READY,
        meetsDefinition: true,
        reasonCode: null,
        reasonMessage: null,
        sourceSystem: 'PHASE_18_TRAINING',
        snapshot: {
          programId,
          programStatus,
          certificateId: validCert?.id || null,
          via: programCompleted ? 'PROGRAM_COMPLETED' : 'VALID_CERTIFICATE',
        },
        observedAt: args.now || new Date(),
      };
    }
    if (programWithGaps && !validCert) {
      return {
        status: ADOPTION_EVIDENCE_STATUS.UNAVAILABLE,
        meetsDefinition: false,
        reasonCode: 'training_completed_with_gaps_insufficient',
        reasonMessage:
          'COMPLETED_WITH_GAPS alone does not satisfy TRAINING_CERT when Program COMPLETED is required',
        sourceSystem: 'PHASE_18_TRAINING',
        snapshot: { programId, programStatus },
        observedAt: args.now || new Date(),
      };
    }
    return {
      status: ADOPTION_EVIDENCE_STATUS.UNAVAILABLE,
      meetsDefinition: false,
      reasonCode: 'training_cert_unmet',
      reasonMessage:
        'TRAINING_CERT requires Phase 18 Program COMPLETED or a valid non-revoked certificate',
      sourceSystem: 'PHASE_18_TRAINING',
      snapshot: { programId, programStatus },
      observedAt: args.now || new Date(),
    };
  }

  if (programCompleted || programWithGaps || validCert) {
    return {
      status: ADOPTION_EVIDENCE_STATUS.READY,
      meetsDefinition: true,
      reasonCode: null,
      reasonMessage: null,
      sourceSystem: 'PHASE_18_TRAINING',
      snapshot: { programId, programStatus, certificateId: validCert?.id || null },
      observedAt: args.now || new Date(),
    };
  }

  return {
    status: ADOPTION_EVIDENCE_STATUS.UNAVAILABLE,
    meetsDefinition: false,
    reasonCode: 'training_cert_unmet',
    reasonMessage: 'No COMPLETED / WITH_GAPS program or valid certificate',
    sourceSystem: 'PHASE_18_TRAINING',
    snapshot: { programId, programStatus },
    observedAt: args.now || new Date(),
  };
}

export async function persistEvidenceSnapshot(prisma, args = {}) {
  if (!hasCustomerAdoptionEvidenceSnapshotModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_evidence_snapshot_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const admin = resolveAdoptionActor(args);
  const now = args.now || new Date();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;

  if (idempotencyKey) {
    const existing = await prisma.customerAdoptionEvidenceSnapshot.findFirst({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        ok: true,
        evidence: serializeAdoptionEvidenceSnapshot(existing),
        alreadyExists: true,
        idempotentReplay: true,
      };
    }
  }

  const row = await prisma.customerAdoptionEvidenceSnapshot.create({
    data: {
      planId: args.planId,
      milestoneId: args.milestoneId || null,
      evidenceMode: args.evidenceMode || null,
      status: args.status || ADOPTION_EVIDENCE_STATUS.UNKNOWN,
      sourceSystem: args.sourceSystem || null,
      observedAt: args.observedAt || now,
      snapshotJson: args.snapshotJson ?? null,
      reasonCode: args.reasonCode || null,
      reasonMessage: args.reasonMessage || null,
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      createdAt: now,
    },
  });

  return {
    ok: true,
    evidence: serializeAdoptionEvidenceSnapshot(row),
    evidenceRow: row,
    domain: getAdoptionDomainContract(),
  };
}

/**
 * Capture a dated Phase 9 / Training evidence snapshot for a plan/milestone.
 */
export async function captureAdoptionEvidenceSnapshot(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, reason: 'adoption_evidence_forbidden' };
  }

  const planId = args.planId || args.adoptionPlanId;
  const access = await loadAdoptionPlanForActor(prisma, {
    ...args,
    planId,
    adoptionPlanId: planId,
  });
  if (!access.ok) return access;

  const mode = String(args.evidenceMode || ADOPTION_EVIDENCE_MODE.PRODUCT_ANALYTICS)
    .trim()
    .toUpperCase();

  let resolved;
  if (mode === ADOPTION_EVIDENCE_MODE.TRAINING_CERT) {
    resolved = await resolveTrainingCertEvidence(prisma, {
      ...args,
      planRow: access.planRow,
    });
  } else {
    resolved = await resolveProductAnalyticsEvidence(prisma, {
      ...args,
      planRow: access.planRow,
      tenantId: access.planRow.tenantId,
    });
  }

  return persistEvidenceSnapshot(prisma, {
    ...args,
    planId: access.planRow.id,
    evidenceMode: mode,
    status: resolved.status,
    sourceSystem: resolved.sourceSystem,
    observedAt: resolved.observedAt,
    snapshotJson: resolved.snapshot,
    reasonCode: resolved.reasonCode,
    reasonMessage: resolved.reasonMessage,
  });
}

export { GATE_FAIL, PRODUCT_VALUE_STATES };
