/**
 * Adoption expansion / renewal handoffs — Phase 19 Wave 3.
 * DRAFT → HANDED_OFF → ACKNOWLEDGED | REJECTED | EXPIRED.
 * Record-only: no Subscription / entitlement / invoice / Tenant GL writes.
 * Idempotent on exact retry (idempotencyKey).
 */

import {
  ADOPTION_EXPANSION_STATUS,
  ADOPTION_EXPANSION_TARGET_QUEUE,
  getAdoptionDomainContract,
} from './catalogue.js';
import {
  canManageAdoption,
  hasCustomerAdoptionExpansionHandoffModel,
  resolveAdoptionActor,
  serializeAdoptionExpansionHandoff,
} from './model.js';
import { loadAdoptionPlanForActor } from './planAccess.js';

const RECORD_ONLY_META = Object.freeze({
  recordOnly: true,
  mutatesSubscription: false,
  mutatesEntitlement: false,
  mutatesInvoice: false,
  mutatesTenantGl: false,
  createsCrmOpportunity: false,
});

function isPrismaUniqueViolation(err) {
  return Boolean(err && typeof err === 'object' && err.code === 'P2002');
}

function normalizeTargetQueue(raw) {
  const q = String(raw || '')
    .trim()
    .toUpperCase();
  const allowed = new Set(Object.values(ADOPTION_EXPANSION_TARGET_QUEUE));
  return allowed.has(q) ? q : null;
}

async function findExpansionByIdempotencyKey(prisma, idempotencyKey) {
  if (!idempotencyKey) return null;
  try {
    const byUnique =
      (await prisma.customerAdoptionExpansionHandoff.findUnique?.({
        where: { idempotencyKey },
      })) || null;
    if (byUnique) return byUnique;
    return await prisma.customerAdoptionExpansionHandoff.findFirst({
      where: { idempotencyKey },
    });
  } catch {
    return null;
  }
}

/**
 * Create (or idempotent-replay) an expansion handoff. Never mutates billing.
 */
export async function createExpansionHandoff(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, error: 'adoption_expansion_forbidden' };
  }
  if (!hasCustomerAdoptionExpansionHandoffModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_expansion_handoff_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const action = String(args.action || '')
    .trim()
    .toLowerCase();
  if (action === 'hand_off' && (args.handoffId || args.id)) {
    return handOffExpansionHandoff(prisma, args);
  }

  const planId = args.planId || args.adoptionPlanId
    ? String(args.planId || args.adoptionPlanId).trim()
    : '';
  if (!planId) return { ok: false, error: 'planId_required' };

  const access = await loadAdoptionPlanForActor(prisma, { ...args, planId });
  if (!access.ok) return access;
  const plan = access.planRow || access.plan;

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (idempotencyKey) {
    const existing = await findExpansionByIdempotencyKey(prisma, idempotencyKey);
    if (existing) {
      return {
        ok: true,
        handoff: serializeAdoptionExpansionHandoff(existing),
        alreadyExists: true,
        idempotentReplay: true,
        meta: { ...RECORD_ONLY_META },
        domain: getAdoptionDomainContract(),
      };
    }
  }

  const targetQueue = normalizeTargetQueue(args.targetQueue);
  if (!targetQueue) {
    return { ok: false, error: 'target_queue_required' };
  }

  let status = ADOPTION_EXPANSION_STATUS.DRAFT;
  if (args.status) {
    const requested = String(args.status).trim().toUpperCase();
    if (
      requested === ADOPTION_EXPANSION_STATUS.DRAFT ||
      requested === ADOPTION_EXPANSION_STATUS.HANDED_OFF
    ) {
      status = requested;
    } else {
      return {
        ok: false,
        error: 'invalid_initial_expansion_status',
        message: 'Initial status may only be DRAFT or HANDED_OFF',
      };
    }
  }

  const signalPackage =
    args.signalPackage && typeof args.signalPackage === 'object'
      ? args.signalPackage
      : null;
  const evidenceRefs =
    args.evidenceRefs ||
    signalPackage?.evidenceRefs ||
    null;

  const now = args.now || new Date();
  let row;
  try {
    row = await prisma.customerAdoptionExpansionHandoff.create({
      data: {
        planId,
        tenantId: plan.tenantId || args.tenantId || null,
        status,
        targetQueue,
        signalPackageJson: signalPackage,
        evidenceRefsJson: Array.isArray(evidenceRefs) ? evidenceRefs : evidenceRefs,
        idempotencyKey,
        createdByAdminId: admin?.id || null,
        handedOffAt: status === ADOPTION_EXPANSION_STATUS.HANDED_OFF ? now : null,
        handedOffByAdminId:
          status === ADOPTION_EXPANSION_STATUS.HANDED_OFF ? admin?.id || null : null,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    // Concurrent exact-key create: recover existing handoff (Wave 1 plans/requests pattern).
    if (isPrismaUniqueViolation(err) && idempotencyKey) {
      const raced = await findExpansionByIdempotencyKey(prisma, idempotencyKey);
      if (raced) {
        return {
          ok: true,
          handoff: serializeAdoptionExpansionHandoff(raced),
          alreadyExists: true,
          idempotentReplay: true,
          meta: { ...RECORD_ONLY_META },
          domain: getAdoptionDomainContract(),
        };
      }
    }
    return {
      ok: false,
      error: err?.message || 'expansion_handoff_create_failed',
    };
  }

  return {
    ok: true,
    handoff: serializeAdoptionExpansionHandoff(row),
    created: true,
    meta: { ...RECORD_ONLY_META },
    domain: getAdoptionDomainContract(),
  };
}

async function handOffExpansionHandoff(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  const planId = args.planId || args.adoptionPlanId
    ? String(args.planId || args.adoptionPlanId).trim()
    : '';
  const handoffId = args.handoffId || args.id ? String(args.handoffId || args.id).trim() : '';
  if (!planId) return { ok: false, error: 'planId_required' };
  if (!handoffId) return { ok: false, error: 'handoffId_required' };

  const access = await loadAdoptionPlanForActor(prisma, { ...args, planId });
  if (!access.ok) return access;

  const row = await prisma.customerAdoptionExpansionHandoff.findUnique({
    where: { id: handoffId },
  });
  if (!row || row.planId !== planId) {
    return { ok: false, notFound: true, error: 'expansion_handoff_not_found' };
  }

  if (row.status === ADOPTION_EXPANSION_STATUS.HANDED_OFF) {
    return {
      ok: true,
      handoff: serializeAdoptionExpansionHandoff(row),
      alreadyInStatus: true,
      meta: { ...RECORD_ONLY_META },
      domain: getAdoptionDomainContract(),
    };
  }
  if (row.status !== ADOPTION_EXPANSION_STATUS.DRAFT) {
    return {
      ok: false,
      error: 'invalid_expansion_transition',
      message: `Cannot hand off from ${row.status}`,
    };
  }

  const now = args.now || new Date();
  const updated = await prisma.customerAdoptionExpansionHandoff.update({
    where: { id: handoffId },
    data: {
      status: ADOPTION_EXPANSION_STATUS.HANDED_OFF,
      handedOffAt: now,
      handedOffByAdminId: admin?.id || null,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    handoff: serializeAdoptionExpansionHandoff(updated),
    meta: { ...RECORD_ONLY_META },
    domain: getAdoptionDomainContract(),
  };
}

/**
 * Acknowledge (or hand_off / reject) an expansion handoff.
 * Stops at ACKNOWLEDGED — never mutates Subscription/entitlement/invoice/GL.
 */
export async function acknowledgeExpansionHandoff(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, error: 'adoption_expansion_forbidden' };
  }
  if (!hasCustomerAdoptionExpansionHandoffModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_expansion_handoff_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const action = String(args.action || 'acknowledge')
    .trim()
    .toLowerCase();
  if (action === 'hand_off') {
    return handOffExpansionHandoff(prisma, args);
  }

  const planId = args.planId || args.adoptionPlanId
    ? String(args.planId || args.adoptionPlanId).trim()
    : '';
  const handoffId = args.handoffId || args.id ? String(args.handoffId || args.id).trim() : '';
  if (!planId) return { ok: false, error: 'planId_required' };
  if (!handoffId) return { ok: false, error: 'handoffId_required' };

  const access = await loadAdoptionPlanForActor(prisma, { ...args, planId });
  if (!access.ok) return access;

  const row = await prisma.customerAdoptionExpansionHandoff.findUnique({
    where: { id: handoffId },
  });
  if (!row || row.planId !== planId) {
    return { ok: false, notFound: true, error: 'expansion_handoff_not_found' };
  }

  const now = args.now || new Date();

  if (action === 'reject') {
    if (
      row.status !== ADOPTION_EXPANSION_STATUS.HANDED_OFF &&
      row.status !== ADOPTION_EXPANSION_STATUS.DRAFT
    ) {
      return { ok: false, error: 'invalid_expansion_transition' };
    }
    const updated = await prisma.customerAdoptionExpansionHandoff.update({
      where: { id: handoffId },
      data: {
        status: ADOPTION_EXPANSION_STATUS.REJECTED,
        updatedAt: now,
      },
    });
    return {
      ok: true,
      handoff: serializeAdoptionExpansionHandoff(updated),
      meta: { ...RECORD_ONLY_META },
      domain: getAdoptionDomainContract(),
    };
  }

  // SoD: creator ≠ acknowledger — default enforce; test-only bypass.
  // Client enforceCreatorAckSoD=false is ignored (HTTP must not disable SoD).
  const enforceCreatorAckSoD = args.allowTestSoDBypass !== true;
  if (
    enforceCreatorAckSoD &&
    row.createdByAdminId &&
    admin?.id &&
    String(row.createdByAdminId) === String(admin.id)
  ) {
    return {
      ok: false,
      error: 'sod_creator_cannot_acknowledge',
      message: 'Handoff creator cannot acknowledge under SoD policy',
    };
  }

  if (row.status === ADOPTION_EXPANSION_STATUS.ACKNOWLEDGED) {
    return {
      ok: true,
      handoff: serializeAdoptionExpansionHandoff(row),
      alreadyInStatus: true,
      meta: { ...RECORD_ONLY_META },
      domain: getAdoptionDomainContract(),
    };
  }

  if (row.status !== ADOPTION_EXPANSION_STATUS.HANDED_OFF) {
    return {
      ok: false,
      error: 'invalid_expansion_transition',
      message: `Acknowledge requires HANDED_OFF (current: ${row.status})`,
    };
  }

  const updated = await prisma.customerAdoptionExpansionHandoff.update({
    where: { id: handoffId },
    data: {
      status: ADOPTION_EXPANSION_STATUS.ACKNOWLEDGED,
      acknowledgedAt: now,
      acknowledgedByAdminId: admin?.id || null,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    handoff: serializeAdoptionExpansionHandoff(updated),
    meta: { ...RECORD_ONLY_META },
    domain: getAdoptionDomainContract(),
  };
}

export async function listExpansionHandoffs(prisma, args = {}) {
  const planId = args.planId || args.adoptionPlanId
    ? String(args.planId || args.adoptionPlanId).trim()
    : '';
  if (!planId) return { ok: false, error: 'planId_required', items: [] };

  const access = await loadAdoptionPlanForActor(prisma, { ...args, planId });
  if (!access.ok) return { ...access, items: [] };

  if (!hasCustomerAdoptionExpansionHandoffModel(prisma)) {
    return {
      ok: true,
      items: [],
      status: 'UNAVAILABLE',
      meta: { unavailable: true, ...RECORD_ONLY_META },
    };
  }

  const rows = await prisma.customerAdoptionExpansionHandoff.findMany({
    where: { planId },
  });
  return {
    ok: true,
    items: (rows || []).map(serializeAdoptionExpansionHandoff),
    meta: { ...RECORD_ONLY_META },
    domain: getAdoptionDomainContract(),
  };
}
