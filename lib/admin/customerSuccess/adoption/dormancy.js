/**
 * Adoption dormancy risk queue + recovery cases — Phase 19 Wave 3.
 * Queue sourced from Phase 9 VALUE_THEN_INACTIVE / inactive-class signals.
 * Analytics missing → UNAVAILABLE (never empty-as-healthy zero).
 * RECOVERED requires server Phase 9 usage-return and/or attested outreach (+ reason).
 * List/queue is portfolio fail-closed — never accept arbitrary tenantId.
 */

import {
  PRODUCT_SIGNAL_CODES,
  evaluateProductSignalsForTenant,
} from '@/lib/admin/productAnalytics/signals.js';
import {
  ADOPTION_DORMANCY_STATUS,
  ADOPTION_DORMANCY_RECOVERED_EVIDENCE_REQUIRED,
  getAdoptionDomainContract,
} from './catalogue.js';
import {
  canManageAdoption,
  canViewAdoption,
  hasCustomerAdoptionDormancyCaseModel,
  resolveAdoptionActor,
  serializeAdoptionDormancyCase,
} from './model.js';
import { loadAdoptionPlanForActor } from './planAccess.js';
import { resolveAdoptionListScope } from './listScope.js';
import { readPhase9ProductEvidence } from './evidence.js';

const INACTIVE_SIGNAL_CODES = new Set([
  PRODUCT_SIGNAL_CODES.VALUE_THEN_INACTIVE,
  'product.value_then_inactive',
]);

function isInactiveClassSignal(signal) {
  if (!signal) return false;
  const code = String(signal.code || '').toLowerCase();
  if (INACTIVE_SIGNAL_CODES.has(signal.code) || INACTIVE_SIGNAL_CODES.has(code)) {
    return true;
  }
  if (code.includes('inactive') || code.includes('dormant')) return true;
  const kind = String(signal.kind || '').toLowerCase();
  return kind === 'inactive' || kind === 'dormancy';
}

function analyticsIsMissing(args = {}) {
  if (args.analyticsAvailable === false) return true;
  if (args.analyticsGate?.status === 'UNAVAILABLE') return true;
  if (args.analyticsGate?.status === 'NOT_INSTRUMENTED') return true;
  return false;
}

/**
 * Phase 9 fact / first-value delegates must be present and readable.
 * Missing models must not be treated as healthy-empty zero signals.
 */
function phase9AnalyticsFactPlaneAvailable(prisma) {
  return Boolean(
    typeof prisma?.analyticsFactProductUsage?.findMany === 'function' &&
      typeof prisma?.productFirstValueFact?.findUnique === 'function'
  );
}

function unavailableDormancyQueue(reasonCode, message) {
  return {
    ok: true,
    status: 'UNAVAILABLE',
    items: [],
    totalRiskCount: null,
    healthyEmpty: false,
    reasonCode,
    message:
      message ||
      'Product analytics missing — dormancy queue UNAVAILABLE (not a healthy zero)',
    domain: getAdoptionDomainContract(),
  };
}

/**
 * Resolve queue tenant under planAccess + portfolio scope.
 * Client tenantId never overrides an in-scope plan's tenant; foreign tenants denied.
 */
async function resolveDormancyQueueTenant(prisma, admin, args = {}) {
  const planId = args.planId || args.adoptionPlanId
    ? String(args.planId || args.adoptionPlanId).trim()
    : '';

  let planRow = null;
  if (planId) {
    const access = await loadAdoptionPlanForActor(prisma, { ...args, planId });
    if (!access.ok) return { ...access, items: [] };
    planRow = access.planRow || access.plan;
  }

  const scopeResult = await resolveAdoptionListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    if (scopeResult.forbidden) {
      return { ok: false, forbidden: true, error: 'adoption_access_forbidden', items: [] };
    }
    return {
      ok: false,
      forbidden: true,
      notFound: true,
      error: 'dormancy_tenant_out_of_scope',
      reason: scopeResult.reason,
      items: [],
    };
  }

  let tenantId = null;
  if (planRow?.tenantId) {
    tenantId = String(planRow.tenantId).trim();
    if (
      args.tenantId != null &&
      String(args.tenantId).trim() &&
      String(args.tenantId).trim() !== tenantId
    ) {
      return {
        ok: false,
        forbidden: true,
        error: 'dormancy_tenant_mismatch',
        lockedTenantId: tenantId,
        requestedTenantId: String(args.tenantId).trim(),
        items: [],
      };
    }
  } else if (args.tenantId != null && String(args.tenantId).trim()) {
    tenantId = String(args.tenantId).trim();
  }

  if (scopeResult.tenantScope != null) {
    if (!tenantId || !scopeResult.tenantScope.includes(String(tenantId))) {
      return {
        ok: false,
        forbidden: true,
        notFound: true,
        error: 'dormancy_tenant_out_of_scope',
        lockedTenantId: tenantId || null,
        items: [],
      };
    }
  }

  return { ok: true, planId, tenantId, planRow, scopeResult };
}

/**
 * List dormancy risk queue for a plan/tenant from Phase 9 signals (read-only).
 */
export async function listDormancyRiskQueue(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canViewAdoption(admin) && !canManageAdoption(admin)) {
    return { ok: false, forbidden: true, error: 'adoption_access_forbidden', items: [] };
  }

  const scoped = await resolveDormancyQueueTenant(prisma, admin, args);
  if (!scoped.ok) return scoped;

  const { planId, tenantId } = scoped;

  if (analyticsIsMissing(args)) {
    return unavailableDormancyQueue('analytics_unavailable');
  }

  let signals = [];
  if (args.allowTestSignalInject === true && Array.isArray(args.signals)) {
    signals = args.signals;
  } else if (args.analyticsAvailable === true && Array.isArray(args.signals)) {
    // Legacy test seam — still require portfolio-scoped tenant above.
    signals = args.signals;
  } else {
    // Live path: never treat missing/unreadable Phase 9 fact plane as healthy zero.
    if (!phase9AnalyticsFactPlaneAvailable(prisma)) {
      return unavailableDormancyQueue(
        'phase9_fact_plane_unavailable',
        'Phase 9 analytics fact/first-value plane missing — dormancy queue UNAVAILABLE (not a healthy zero)'
      );
    }

    if (!tenantId) {
      return unavailableDormancyQueue('tenant_required');
    }
    try {
      const evaluation = await evaluateProductSignalsForTenant(prisma, {
        tenantId: String(tenantId),
        now: args.now,
        inactivityDays: args.inactivityDays,
      });
      if (!evaluation?.ok) {
        return unavailableDormancyQueue(
          evaluation?.reasonCode || 'signals_unavailable'
        );
      }
      signals = evaluation.signals || [];
    } catch {
      return unavailableDormancyQueue('signals_read_failed');
    }
  }

  const items = (signals || []).filter(isInactiveClassSignal).map((s) => ({
    identity: s.identity || s.id || null,
    code: s.code,
    featureCode: s.featureCode || null,
    severity: s.severity || null,
    kind: s.kind || null,
    title: s.title || null,
    payload: s.payload || null,
    planId: planId || null,
    tenantId: tenantId || s.tenantId || null,
  }));

  return {
    ok: true,
    status: 'READY',
    items,
    totalRiskCount: items.length,
    healthyEmpty: items.length === 0,
    domain: getAdoptionDomainContract(),
  };
}

/**
 * Open a dormancy recovery case from a Phase 9 inactive-class signal.
 */
export async function openDormancyRecoveryCase(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, error: 'adoption_dormancy_forbidden' };
  }
  if (!hasCustomerAdoptionDormancyCaseModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_dormancy_case_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const planId = args.planId || args.adoptionPlanId
    ? String(args.planId || args.adoptionPlanId).trim()
    : '';
  if (!planId) return { ok: false, error: 'planId_required' };

  const access = await loadAdoptionPlanForActor(prisma, { ...args, planId });
  if (!access.ok) return access;
  const plan = access.planRow || access.plan;

  const signalCode = args.signalCode
    ? String(args.signalCode).trim()
    : PRODUCT_SIGNAL_CODES.VALUE_THEN_INACTIVE;
  if (!isInactiveClassSignal({ code: signalCode })) {
    return { ok: false, error: 'inactive_class_signal_required' };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (idempotencyKey) {
    const existing = await prisma.customerAdoptionDormancyCase.findFirst({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        ok: true,
        case: serializeAdoptionDormancyCase(existing),
        alreadyExists: true,
        idempotentReplay: true,
        domain: getAdoptionDomainContract(),
      };
    }
  }

  const now = args.now || new Date();
  const row = await prisma.customerAdoptionDormancyCase.create({
    data: {
      planId,
      tenantId: plan.tenantId || args.tenantId || null,
      status: ADOPTION_DORMANCY_STATUS.OPEN,
      signalIdentity: args.signalIdentity
        ? String(args.signalIdentity).trim()
        : null,
      signalCode,
      featureCode: args.featureCode ? String(args.featureCode).trim() : null,
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    case: serializeAdoptionDormancyCase(row),
    created: true,
    domain: getAdoptionDomainContract(),
  };
}

function usageReturnMeetsDefinition(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  return (
    snapshot.returned === true ||
    snapshot.usageReturned === true ||
    snapshot.meetsDefinition === true
  );
}

/**
 * Server Phase 9 usage-return evidence. Client snapshots ignored unless test inject.
 */
async function resolveServerUsageReturnSnapshot(prisma, args, plan, dormancyCase) {
  if (
    args.allowTestEvidenceInject === true &&
    args.usageReturnSnapshot &&
    typeof args.usageReturnSnapshot === 'object'
  ) {
    return {
      snapshot: args.usageReturnSnapshot,
      source: 'TEST_INJECT',
    };
  }

  const tenantId =
    plan?.tenantId || dormancyCase?.tenantId || args.tenantId || null;
  const featureCode =
    dormancyCase?.featureCode || args.featureCode || 'invoices.post';
  if (!tenantId || !featureCode) return { snapshot: null, source: null };

  try {
    const snap = await readPhase9ProductEvidence(prisma, {
      tenantId: String(tenantId),
      featureCode: String(featureCode),
      now: args.now || new Date(),
    });
    if (!snap || snap.meetsDefinition !== true) {
      return { snapshot: null, source: 'PHASE_9_PRODUCT_ANALYTICS' };
    }
    const stillInactive = (snap.signals || []).some(isInactiveClassSignal);
    if (stillInactive) {
      return { snapshot: null, source: 'PHASE_9_PRODUCT_ANALYTICS' };
    }
    return {
      snapshot: {
        returned: true,
        usageReturned: true,
        meetsDefinition: true,
        sourceSystem: 'PHASE_9_PRODUCT_ANALYTICS',
        featureCode: String(featureCode),
        tenantId: String(tenantId),
        observedAt: snap.observedAt || new Date().toISOString(),
        phase9Snapshot: snap,
      },
      source: 'PHASE_9_PRODUCT_ANALYTICS',
    };
  } catch {
    return { snapshot: null, source: 'PHASE_9_PRODUCT_ANALYTICS' };
  }
}

/**
 * Attest dormancy outcome. RECOVERED requires server Phase 9 usage-return
 * and/or attested outreach (+ reason). Client usageReturnSnapshot is ignored
 * unless allowTestEvidenceInject.
 */
export async function attestDormancyOutcome(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, error: 'adoption_dormancy_forbidden' };
  }
  if (!hasCustomerAdoptionDormancyCaseModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_dormancy_case_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const planId = args.planId || args.adoptionPlanId
    ? String(args.planId || args.adoptionPlanId).trim()
    : '';
  const dormancyCaseId = args.dormancyCaseId || args.caseId
    ? String(args.dormancyCaseId || args.caseId).trim()
    : '';
  if (!planId) return { ok: false, error: 'planId_required' };
  if (!dormancyCaseId) return { ok: false, error: 'dormancyCaseId_required' };

  const access = await loadAdoptionPlanForActor(prisma, { ...args, planId });
  if (!access.ok) return access;
  const plan = access.planRow || access.plan;

  const row = await prisma.customerAdoptionDormancyCase.findUnique({
    where: { id: dormancyCaseId },
  });
  if (!row || row.planId !== planId) {
    return { ok: false, notFound: true, error: 'dormancy_case_not_found' };
  }

  const outcome = String(args.outcome || args.toStatus || '')
    .trim()
    .toUpperCase();
  const terminal = new Set([
    ADOPTION_DORMANCY_STATUS.RECOVERED,
    ADOPTION_DORMANCY_STATUS.ESCALATED,
    ADOPTION_DORMANCY_STATUS.CLOSED_UNRESOLVED,
    ADOPTION_DORMANCY_STATUS.MONITORING,
  ]);
  if (!terminal.has(outcome)) {
    return { ok: false, error: 'invalid_dormancy_outcome' };
  }

  const now = args.now || new Date();
  const outreachAttested =
    args.outreachAttested === true ||
    args.attestedOutreach === true ||
    Boolean(args.outreachAttestation);
  const reason =
    args.reason != null ? String(args.reason).trim().slice(0, 2000) : '';

  let usageReturn = null;
  if (outcome === ADOPTION_DORMANCY_STATUS.RECOVERED) {
    const resolved = await resolveServerUsageReturnSnapshot(
      prisma,
      args,
      plan,
      row
    );
    usageReturn = usageReturnMeetsDefinition(resolved.snapshot)
      ? resolved.snapshot
      : null;
    const hasUsageReturn = Boolean(usageReturn);
    const hasOutreach = outreachAttested && Boolean(reason);
    if (!hasUsageReturn && !hasOutreach) {
      return {
        ok: false,
        error: ADOPTION_DORMANCY_RECOVERED_EVIDENCE_REQUIRED,
        message:
          'RECOVERED requires server Phase 9 usage-return evidence and/or attested outreach with reason',
      };
    }
  }

  const updated = await prisma.customerAdoptionDormancyCase.update({
    where: { id: dormancyCaseId },
    data: {
      status: outcome,
      usageReturnSnapshotJson: usageReturn || row.usageReturnSnapshotJson || null,
      outreachAttestedAt: outreachAttested
        ? now
        : row.outreachAttestedAt || null,
      outreachAttestedByAdminId: outreachAttested
        ? admin?.id || null
        : row.outreachAttestedByAdminId || null,
      outcomeReason: reason || null,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    case: serializeAdoptionDormancyCase(updated),
    domain: getAdoptionDomainContract(),
  };
}
