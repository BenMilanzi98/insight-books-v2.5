/**
 * Adoption milestones — materialise from pinned template; evaluate / attest / waive.
 * PRODUCT_ANALYTICS | TRAINING_CERT | CS_ATTESTATION | MIXED.
 * Gate fail → UNKNOWN + UNAVAILABLE — never invent MET.
 */

import {
  ADOPTION_EVIDENCE_MODE,
  ADOPTION_EVIDENCE_STATUS,
  ADOPTION_MILESTONE_STATUS,
  WAVE2_DEFAULT_MILESTONE_DEFS,
  getAdoptionDomainContract,
} from './catalogue.js';
import {
  canManageAdoption,
  hasCustomerAdoptionMilestoneModel,
  hasCustomerAdoptionPlanTemplateVersionModel,
  resolveAdoptionActor,
  serializeAdoptionMilestone,
} from './model.js';
import { loadAdoptionPlanForActor } from './planAccess.js';
import {
  persistEvidenceSnapshot,
  resolveProductAnalyticsEvidence,
  resolveTrainingCertEvidence,
} from './evidence.js';

function milestoneDefsFromTemplate(contentJson) {
  const c = contentJson && typeof contentJson === 'object' ? contentJson : {};
  if (Array.isArray(c.milestones) && c.milestones.length) {
    return c.milestones;
  }
  return [...WAVE2_DEFAULT_MILESTONE_DEFS];
}

/**
 * Materialise milestones from the Plan's pinned templateVersion (idempotent per plan/version).
 */
export async function materialiseAdoptionMilestones(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, reason: 'adoption_milestone_materialise_forbidden' };
  }
  if (!hasCustomerAdoptionMilestoneModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_milestone_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const planId = args.planId || args.adoptionPlanId
    ? String(args.planId || args.adoptionPlanId).trim()
    : '';
  if (!planId) return { ok: false, error: 'planId_required' };

  const access = await loadAdoptionPlanForActor(prisma, {
    ...args,
    planId,
    adoptionPlanId: planId,
  });
  if (!access.ok) return access;
  const plan = access.planRow;

  const templateVersionId = plan.planTemplateVersionId || plan.templateVersionId;
  if (!templateVersionId) {
    return { ok: false, error: 'plan_template_version_missing' };
  }

  const existing = await prisma.customerAdoptionMilestone.findMany({
    where: { planId: plan.id, planTemplateVersionId: String(templateVersionId) },
  });
  if (existing.length) {
    return {
      ok: true,
      milestones: existing.map(serializeAdoptionMilestone),
      alreadyExists: true,
      idempotentReplay: true,
      domain: getAdoptionDomainContract(),
    };
  }

  let contentJson = null;
  if (hasCustomerAdoptionPlanTemplateVersionModel(prisma)) {
    const tv = await prisma.customerAdoptionPlanTemplateVersion.findUnique({
      where: { id: String(templateVersionId) },
    });
    contentJson = tv?.contentJson || null;
  }
  if (args.templateContentJson) contentJson = args.templateContentJson;

  const defs = milestoneDefsFromTemplate(contentJson);
  const now = args.now || new Date();
  const created = [];

  for (const def of defs) {
    const templateKey = String(def.key || def.templateKey || '').trim();
    if (!templateKey) continue;

    const prior = await prisma.customerAdoptionMilestone.findFirst({
      where: { planId: plan.id, templateKey },
    });
    if (prior) {
      created.push(prior);
      continue;
    }

    const row = await prisma.customerAdoptionMilestone.create({
      data: {
        planId: plan.id,
        planTemplateVersionId: String(templateVersionId),
        templateKey,
        roleTarget: def.roleTarget || null,
        evidenceMode: String(def.evidenceMode || '').toUpperCase(),
        status: ADOPTION_MILESTONE_STATUS.NOT_STARTED,
        critical: def.critical === true,
        dueAt: def.dueAt ? new Date(def.dueAt) : null,
        definitionJson: def,
        createdByAdminId: admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
    created.push(row);
  }

  return {
    ok: true,
    milestones: created.map(serializeAdoptionMilestone),
    created: true,
    domain: getAdoptionDomainContract(),
  };
}

async function loadMilestone(prisma, milestoneId) {
  const id = milestoneId ? String(milestoneId).trim() : '';
  if (!id || !hasCustomerAdoptionMilestoneModel(prisma)) return null;
  return prisma.customerAdoptionMilestone.findUnique({ where: { id } });
}

/**
 * Evaluate a milestone against its evidence mode.
 */
export async function evaluateAdoptionMilestone(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, reason: 'adoption_milestone_evaluate_forbidden' };
  }
  if (!hasCustomerAdoptionMilestoneModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_milestone_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const planId = args.planId || args.adoptionPlanId;
  const access = await loadAdoptionPlanForActor(prisma, {
    ...args,
    planId,
    adoptionPlanId: planId,
  });
  if (!access.ok) return access;

  const milestoneId = args.milestoneId ? String(args.milestoneId).trim() : '';
  if (!milestoneId) return { ok: false, error: 'milestoneId_required' };

  const milestone = await loadMilestone(prisma, milestoneId);
  if (!milestone || String(milestone.planId) !== String(access.planRow.id)) {
    return { ok: false, notFound: true, error: 'adoption_milestone_not_found' };
  }

  const mode = String(milestone.evidenceMode || '').toUpperCase();
  const def = milestone.definitionJson || {};
  const now = args.now || new Date();

  let evidenceStatus = ADOPTION_EVIDENCE_STATUS.UNAVAILABLE;
  let nextStatus = ADOPTION_MILESTONE_STATUS.UNKNOWN;
  let reasonCode = null;
  let reasonMessage = null;
  let sourceSystem = null;
  let snapshotJson = null;
  let observedAt = now;

  const phase9Args = {
    ...args,
    definition: def,
    planRow: access.planRow,
    tenantId: access.planRow.tenantId,
  };

  if (mode === ADOPTION_EVIDENCE_MODE.PRODUCT_ANALYTICS) {
    const resolved = await resolveProductAnalyticsEvidence(prisma, phase9Args);
    evidenceStatus = resolved.status;
    reasonCode = resolved.reasonCode;
    reasonMessage = resolved.reasonMessage;
    sourceSystem = resolved.sourceSystem;
    snapshotJson = resolved.snapshot;
    observedAt = resolved.observedAt;
    nextStatus = resolved.meetsDefinition
      ? ADOPTION_MILESTONE_STATUS.MET
      : ADOPTION_MILESTONE_STATUS.UNKNOWN;
  } else if (mode === ADOPTION_EVIDENCE_MODE.TRAINING_CERT) {
    const resolved = await resolveTrainingCertEvidence(prisma, {
      ...args,
      planRow: access.planRow,
      definition: def,
    });
    evidenceStatus = resolved.status;
    reasonCode = resolved.reasonCode;
    reasonMessage = resolved.reasonMessage;
    sourceSystem = resolved.sourceSystem;
    snapshotJson = resolved.snapshot;
    observedAt = resolved.observedAt;
    nextStatus = resolved.meetsDefinition
      ? ADOPTION_MILESTONE_STATUS.MET
      : ADOPTION_MILESTONE_STATUS.UNKNOWN;
  } else if (mode === ADOPTION_EVIDENCE_MODE.CS_ATTESTATION) {
    if (
      milestone.status === ADOPTION_MILESTONE_STATUS.MET &&
      milestone.attestedByAdminId
    ) {
      evidenceStatus = ADOPTION_EVIDENCE_STATUS.READY;
      nextStatus = ADOPTION_MILESTONE_STATUS.MET;
      sourceSystem = 'CS_ATTESTATION';
      snapshotJson = {
        attestedByAdminId: milestone.attestedByAdminId,
        reason: milestone.attestationReason,
      };
    } else if (milestone.status === ADOPTION_MILESTONE_STATUS.WAIVED) {
      evidenceStatus = ADOPTION_EVIDENCE_STATUS.READY;
      nextStatus = ADOPTION_MILESTONE_STATUS.WAIVED;
      sourceSystem = 'CS_WAIVER';
    } else {
      evidenceStatus = ADOPTION_EVIDENCE_STATUS.UNAVAILABLE;
      nextStatus = ADOPTION_MILESTONE_STATUS.NOT_STARTED;
      reasonCode = 'attestation_required';
      reasonMessage = 'CS_ATTESTATION requires attestAdoptionMilestone with manage + reason';
      sourceSystem = 'CS_ATTESTATION';
    }
  } else if (mode === ADOPTION_EVIDENCE_MODE.MIXED) {
    const required = Array.isArray(def.requiredModes)
      ? def.requiredModes.map((m) => String(m).toUpperCase())
      : [ADOPTION_EVIDENCE_MODE.PRODUCT_ANALYTICS, ADOPTION_EVIDENCE_MODE.CS_ATTESTATION];

    const parts = {};
    let allMet = true;

    if (required.includes(ADOPTION_EVIDENCE_MODE.PRODUCT_ANALYTICS)) {
      const pa = await resolveProductAnalyticsEvidence(prisma, phase9Args);
      parts.PRODUCT_ANALYTICS = pa;
      if (!pa.meetsDefinition) allMet = false;
    }
    if (required.includes(ADOPTION_EVIDENCE_MODE.TRAINING_CERT)) {
      const tc = await resolveTrainingCertEvidence(prisma, {
        ...args,
        planRow: access.planRow,
        definition: def,
      });
      parts.TRAINING_CERT = tc;
      if (!tc.meetsDefinition) allMet = false;
    }
    if (required.includes(ADOPTION_EVIDENCE_MODE.CS_ATTESTATION)) {
      // Attestation leg only — attestedByAdminId; do not require status MET
      // (MIXED MET is set only when all required legs meet).
      const attested = Boolean(milestone.attestedByAdminId);
      parts.CS_ATTESTATION = { meetsDefinition: attested };
      if (!attested) allMet = false;
    }

    snapshotJson = parts;
    sourceSystem = 'MIXED';
    if (allMet) {
      evidenceStatus = ADOPTION_EVIDENCE_STATUS.READY;
      nextStatus = ADOPTION_MILESTONE_STATUS.MET;
    } else {
      evidenceStatus = ADOPTION_EVIDENCE_STATUS.UNAVAILABLE;
      nextStatus = ADOPTION_MILESTONE_STATUS.UNKNOWN;
      reasonCode = 'mixed_evidence_incomplete';
      reasonMessage = 'MIXED requires all required evidence modes present';
    }
  } else {
    return { ok: false, error: `unsupported_evidence_mode:${mode}` };
  }

  // Honesty: never leave MET when evidence is UNAVAILABLE (except existing WAIVED).
  if (
    evidenceStatus === ADOPTION_EVIDENCE_STATUS.UNAVAILABLE &&
    nextStatus === ADOPTION_MILESTONE_STATUS.MET
  ) {
    nextStatus = ADOPTION_MILESTONE_STATUS.UNKNOWN;
  }

  const persisted = await persistEvidenceSnapshot(prisma, {
    admin,
    planId: access.planRow.id,
    milestoneId: milestone.id,
    evidenceMode: mode,
    status: evidenceStatus,
    sourceSystem,
    observedAt,
    snapshotJson,
    reasonCode,
    reasonMessage,
    idempotencyKey: args.idempotencyKey
      ? String(args.idempotencyKey).trim()
      : `eval:${milestone.id}:${now.toISOString()}`,
    now,
  });

  const updated = await prisma.customerAdoptionMilestone.update({
    where: { id: milestone.id },
    data: {
      status: nextStatus,
      evidenceSnapshotId: persisted.evidence?.id || null,
      lastEvaluatedAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    milestone: serializeAdoptionMilestone(updated),
    evidenceStatus,
    evidence: persisted.evidence || null,
    reasonCode,
    reasonMessage,
    domain: getAdoptionDomainContract(),
  };
}

/**
 * CS attestation — manageCases + planAccess + reason required.
 * Applies only to CS_ATTESTATION (MET) or MIXED attestation leg
 * (records attestation; does not MET PRODUCT_ANALYTICS / TRAINING_CERT alone).
 */
export async function attestAdoptionMilestone(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, reason: 'adoption_milestone_attest_forbidden' };
  }
  if (!hasCustomerAdoptionMilestoneModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_milestone_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const planId = args.planId || args.adoptionPlanId;
  const access = await loadAdoptionPlanForActor(prisma, {
    ...args,
    planId,
    adoptionPlanId: planId,
  });
  if (!access.ok) return access;

  const reason = args.reason != null ? String(args.reason).trim() : '';
  if (!reason) return { ok: false, error: 'attestation_reason_required' };

  const milestoneId = args.milestoneId ? String(args.milestoneId).trim() : '';
  if (!milestoneId) return { ok: false, error: 'milestoneId_required' };

  const milestone = await loadMilestone(prisma, milestoneId);
  if (!milestone || String(milestone.planId) !== String(access.planRow.id)) {
    return { ok: false, notFound: true, error: 'adoption_milestone_not_found' };
  }

  const mode = String(milestone.evidenceMode || '').toUpperCase();
  if (
    mode !== ADOPTION_EVIDENCE_MODE.CS_ATTESTATION &&
    mode !== ADOPTION_EVIDENCE_MODE.MIXED
  ) {
    return {
      ok: false,
      error: 'attestation_mode_forbidden',
      reason:
        'attestAdoptionMilestone applies only to CS_ATTESTATION or MIXED attestation leg — not PRODUCT_ANALYTICS / TRAINING_CERT',
      evidenceMode: mode,
    };
  }

  const now = args.now || new Date();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;

  if (idempotencyKey && milestone.attestedByAdminId) {
    const alreadyMet =
      mode === ADOPTION_EVIDENCE_MODE.CS_ATTESTATION &&
      milestone.status === ADOPTION_MILESTONE_STATUS.MET;
    const mixedAttested =
      mode === ADOPTION_EVIDENCE_MODE.MIXED && milestone.attestedByAdminId;
    if (alreadyMet || mixedAttested) {
      return {
        ok: true,
        milestone: serializeAdoptionMilestone(milestone),
        alreadyExists: true,
        idempotentReplay: true,
        domain: getAdoptionDomainContract(),
      };
    }
  }

  await persistEvidenceSnapshot(prisma, {
    admin,
    planId: access.planRow.id,
    milestoneId: milestone.id,
    evidenceMode: ADOPTION_EVIDENCE_MODE.CS_ATTESTATION,
    status: ADOPTION_EVIDENCE_STATUS.READY,
    sourceSystem: 'CS_ATTESTATION',
    observedAt: now,
    snapshotJson: {
      reason,
      attestedByAdminId: admin.id,
      evidenceMode: mode,
      attestationLegOnly: mode === ADOPTION_EVIDENCE_MODE.MIXED,
    },
    idempotencyKey: idempotencyKey || `attest:${milestone.id}:${now.toISOString()}`,
    now,
  });

  // CS_ATTESTATION → MET via attestation alone.
  // MIXED → record attestation leg only; MET requires evaluate (all required modes).
  const nextStatus =
    mode === ADOPTION_EVIDENCE_MODE.CS_ATTESTATION
      ? ADOPTION_MILESTONE_STATUS.MET
      : milestone.status === ADOPTION_MILESTONE_STATUS.MET
        ? ADOPTION_MILESTONE_STATUS.MET
        : ADOPTION_MILESTONE_STATUS.IN_PROGRESS;

  const updated = await prisma.customerAdoptionMilestone.update({
    where: { id: milestone.id },
    data: {
      status: nextStatus,
      attestedByAdminId: admin.id,
      attestedAt: now,
      attestationReason: reason.slice(0, 2000),
      lastEvaluatedAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    milestone: serializeAdoptionMilestone(updated),
    attestationLegOnly: mode === ADOPTION_EVIDENCE_MODE.MIXED,
    domain: getAdoptionDomainContract(),
  };
}

/**
 * Waive milestone — critical waiver SoD: attestor ≠ sole waver.
 */
export async function waiveAdoptionMilestone(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, reason: 'adoption_milestone_waive_forbidden' };
  }
  if (!hasCustomerAdoptionMilestoneModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_milestone_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const planId = args.planId || args.adoptionPlanId;
  const access = await loadAdoptionPlanForActor(prisma, {
    ...args,
    planId,
    adoptionPlanId: planId,
  });
  if (!access.ok) return access;

  const reason = args.reason != null ? String(args.reason).trim() : '';
  if (!reason) return { ok: false, error: 'waiver_reason_required' };

  const milestoneId = args.milestoneId ? String(args.milestoneId).trim() : '';
  if (!milestoneId) return { ok: false, error: 'milestoneId_required' };

  const milestone = await loadMilestone(prisma, milestoneId);
  if (!milestone || String(milestone.planId) !== String(access.planRow.id)) {
    return { ok: false, notFound: true, error: 'adoption_milestone_not_found' };
  }

  if (
    milestone.critical === true &&
    milestone.attestedByAdminId &&
    String(milestone.attestedByAdminId) === String(admin.id)
  ) {
    return {
      ok: false,
      error: 'critical_waiver_sod_violation',
      message:
        'Critical milestone waiver requires separation of duties — attestor cannot sole-waive',
    };
  }

  const now = args.now || new Date();
  const updated = await prisma.customerAdoptionMilestone.update({
    where: { id: milestone.id },
    data: {
      status: ADOPTION_MILESTONE_STATUS.WAIVED,
      waivedByAdminId: admin.id,
      waivedAt: now,
      waiverReason: reason.slice(0, 2000),
      lastEvaluatedAt: now,
      updatedAt: now,
    },
  });

  await persistEvidenceSnapshot(prisma, {
    admin,
    planId: access.planRow.id,
    milestoneId: milestone.id,
    evidenceMode: milestone.evidenceMode,
    status: ADOPTION_EVIDENCE_STATUS.READY,
    sourceSystem: 'CS_WAIVER',
    observedAt: now,
    snapshotJson: { reason, waivedByAdminId: admin.id, critical: milestone.critical },
    idempotencyKey: args.idempotencyKey
      ? String(args.idempotencyKey).trim()
      : `waive:${milestone.id}:${now.toISOString()}`,
    now,
  });

  return {
    ok: true,
    milestone: serializeAdoptionMilestone(updated),
    domain: getAdoptionDomainContract(),
  };
}

export async function listAdoptionMilestones(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin) && !admin) {
    return { ok: false, forbidden: true };
  }
  if (!hasCustomerAdoptionMilestoneModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_milestone_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const planId = args.planId || args.adoptionPlanId;
  const access = await loadAdoptionPlanForActor(prisma, {
    ...args,
    planId,
    adoptionPlanId: planId,
  });
  if (!access.ok) return access;

  const rows = await prisma.customerAdoptionMilestone.findMany({
    where: { planId: access.planRow.id },
  });
  return {
    ok: true,
    milestones: rows.map(serializeAdoptionMilestone),
    domain: getAdoptionDomainContract(),
  };
}
