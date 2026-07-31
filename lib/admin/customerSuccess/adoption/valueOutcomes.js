/**
 * Adoption value outcomes — Phase 9 snapshot + lineage.
 * Missing / gate fail → status UNAVAILABLE, value null — never false zero.
 * Client measuredValue / analyticsGate never invent READY unless test inject
 * or CS-attested path (manage + planAccess + reason).
 */

import {
  ADOPTION_VALUE_OUTCOME_STATUS,
  ADOPTION_VALUE_OUTCOME_TYPE,
  ADOPTION_VALUE_REVIEW_STATE,
  getAdoptionDomainContract,
} from './catalogue.js';
import {
  canManageAdoption,
  hasCustomerAdoptionValueOutcomeModel,
  resolveAdoptionActor,
  serializeAdoptionValueOutcome,
  serializeAdoptionPlan,
} from './model.js';
import { loadAdoptionPlanForActor } from './planAccess.js';
import { PRODUCT_RELIABILITY_STATUS } from '@/lib/admin/productAnalytics/catalogue.js';
import { evaluateProductReliability } from '@/lib/admin/productAnalytics/reliabilityGate.js';
import { readPhase9ProductEvidence } from './evidence.js';

function isGateFail(gate) {
  if (!gate) return false;
  const status = String(gate.status || '').toUpperCase();
  return (
    status &&
    status !== PRODUCT_RELIABILITY_STATUS.AVAILABLE &&
    status !== 'AVAILABLE' &&
    status !== 'READY'
  );
}

function pickClientMeasuredValue(args = {}) {
  const hasMeasuredValue =
    args.measuredValue !== undefined && args.measuredValue !== null;
  const hasValueAlias = args.value !== undefined && args.value !== null;
  if (!hasMeasuredValue && !hasValueAlias) return null;
  return hasMeasuredValue ? args.measuredValue : args.value;
}

function unavailableOutcomeFields(gate, reasonCode, reasonMessage) {
  return {
    status: ADOPTION_VALUE_OUTCOME_STATUS.UNAVAILABLE,
    value: null,
    reasonCode:
      reasonCode ||
      (gate && (gate.reasonCode || String(gate.status || '').toLowerCase())) ||
      'value_measurement_unavailable',
    reasonMessage:
      reasonMessage ||
      (gate && gate.reasonMessage) ||
      'Value outcome unavailable — null value, not a false zero',
  };
}

/**
 * Record a value outcome snapshot. Null/UNAVAILABLE on missing analytics — never 0-as-success.
 * Server Phase 9 or CS-attested (+ reason) only; client invents blocked without inject.
 */
export async function recordAdoptionValueOutcome(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, reason: 'adoption_value_outcome_forbidden' };
  }
  if (!hasCustomerAdoptionValueOutcomeModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_value_outcome_model_unavailable',
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

  const outcomeType = String(
    args.outcomeType || ADOPTION_VALUE_OUTCOME_TYPE.TIME_TO_FIRST_VALUE
  )
    .trim()
    .toUpperCase();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!idempotencyKey) return { ok: false, error: 'idempotency_key_required' };

  const existing = await prisma.customerAdoptionValueOutcome.findUnique({
    where: { idempotencyKey },
  }).catch(async () =>
    prisma.customerAdoptionValueOutcome.findFirst({ where: { idempotencyKey } })
  );
  if (existing) {
    return {
      ok: true,
      outcome: serializeAdoptionValueOutcome(existing),
      alreadyExists: true,
      idempotentReplay: true,
      domain: getAdoptionDomainContract(),
    };
  }

  const now = args.now || new Date();
  const allowInject = args.allowTestEvidenceInject === true;
  const attestReason =
    args.reason != null ? String(args.reason).trim().slice(0, 2000) : '';
  const csAttested =
    (args.csAttested === true || args.attested === true) && Boolean(attestReason);

  let gate = null;
  let value = null;
  let status = ADOPTION_VALUE_OUTCOME_STATUS.READY;
  let reasonCode = null;
  let reasonMessage = null;
  let phase9Ref = args.phase9Ref || null;
  let sourceSystem = args.sourceSystem || 'PHASE_9_PRODUCT_ANALYTICS';
  let lineageExtras = {};

  if (allowInject) {
    gate = args.analyticsGate || null;
    value = pickClientMeasuredValue(args);
    if (isGateFail(gate) || value === null) {
      ({ status, value, reasonCode, reasonMessage } = unavailableOutcomeFields(
        gate,
        null,
        null
      ));
    }
    lineageExtras = { evidencePath: 'TEST_INJECT' };
  } else if (csAttested) {
    // CS-attested path — manage + planAccess already enforced; reason required.
    gate = { status: 'AVAILABLE', source: 'CS_ATTESTATION' };
    value = pickClientMeasuredValue(args);
    sourceSystem = args.sourceSystem || 'CS_ATTESTATION';
    if (value === null) {
      ({ status, value, reasonCode, reasonMessage } = unavailableOutcomeFields(
        gate,
        'cs_attested_value_missing',
        'CS-attested value outcome requires a measured value'
      ));
    }
    lineageExtras = {
      evidencePath: 'CS_ATTESTATION',
      csAttested: true,
      reason: attestReason,
      attestedByAdminId: admin?.id || null,
    };
  } else {
    // Server Phase 9 only — ignore client analyticsGate / measuredValue.
    const tenantId = access.planRow?.tenantId || null;
    const featureCode = args.featureCode || 'invoices.post';
    const metricCode =
      args.metricCode || 'product.feature.invoices.post.count';
    gate = evaluateProductReliability(metricCode, {
      featureCode,
      permissionOk: args.permissionOk !== false,
      definitionActive: args.definitionActive !== false,
    });
    if (isGateFail(gate)) {
      ({ status, value, reasonCode, reasonMessage } = unavailableOutcomeFields(
        gate,
        null,
        'Phase 9 reliability gate failed — value UNAVAILABLE'
      ));
      lineageExtras = { evidencePath: 'PHASE_9', gate };
    } else if (!tenantId) {
      ({ status, value, reasonCode, reasonMessage } = unavailableOutcomeFields(
        gate,
        'tenant_required',
        'Plan tenant missing — value UNAVAILABLE'
      ));
      lineageExtras = { evidencePath: 'PHASE_9' };
    } else {
      const snap = await readPhase9ProductEvidence(prisma, {
        tenantId: String(tenantId),
        featureCode: String(featureCode),
        now,
      });
      const serverValue =
        snap &&
        (snap.measuredValue !== undefined && snap.measuredValue !== null
          ? snap.measuredValue
          : snap.value !== undefined && snap.value !== null
            ? snap.value
            : null);
      if (!snap || snap.meetsDefinition !== true || serverValue === null) {
        ({ status, value, reasonCode, reasonMessage } = unavailableOutcomeFields(
          gate,
          snap ? 'phase9_measurement_unavailable' : 'phase9_snapshot_unreadable',
          'Phase 9 measurement missing/unreadable — value UNAVAILABLE (never invent READY)'
        ));
        lineageExtras = {
          evidencePath: 'PHASE_9',
          gate,
          phase9Snapshot: snap || null,
        };
      } else {
        value = serverValue;
        phase9Ref = phase9Ref || snap;
        lineageExtras = {
          evidencePath: 'PHASE_9',
          gate,
          phase9Snapshot: snap,
        };
      }
    }
  }

  const row = await prisma.customerAdoptionValueOutcome.create({
    data: {
      planId: access.planRow.id,
      outcomeType,
      status,
      value,
      sourceSystem,
      observedAt: args.observedAt ? new Date(args.observedAt) : now,
      lineageJson: {
        analyticsGate: gate,
        phase9Ref,
        sourceSystem,
        observedAt:
          (args.observedAt && new Date(args.observedAt).toISOString()) ||
          now.toISOString(),
        ...lineageExtras,
      },
      reasonCode,
      reasonMessage,
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    outcome: serializeAdoptionValueOutcome(row),
    domain: getAdoptionDomainContract(),
  };
}

/**
 * Sign off value review on the Plan (required for Plan COMPLETED).
 */
export async function signOffAdoptionValueReview(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, reason: 'adoption_value_review_forbidden' };
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

  const reason = args.reason != null ? String(args.reason).trim() : '';
  if (!reason) return { ok: false, error: 'value_review_reason_required' };

  const now = args.now || new Date();
  const updated = await prisma.customerAdoptionPlan.update({
    where: { id: access.planRow.id },
    data: {
      valueReviewState: ADOPTION_VALUE_REVIEW_STATE.SIGNED_OFF,
      updatedAt: now,
    },
  });

  // Persist sign-off lineage as a value outcome row when model present
  if (hasCustomerAdoptionValueOutcomeModel(prisma)) {
    const key =
      (args.idempotencyKey && String(args.idempotencyKey).trim()) ||
      `value-review:${access.planRow.id}:${now.toISOString()}`;
    const existing = await prisma.customerAdoptionValueOutcome.findFirst({
      where: { idempotencyKey: key },
    });
    if (!existing) {
      await prisma.customerAdoptionValueOutcome.create({
        data: {
          planId: access.planRow.id,
          outcomeType: 'VALUE_REVIEW_SIGN_OFF',
          status: ADOPTION_VALUE_OUTCOME_STATUS.READY,
          value: null,
          sourceSystem: 'ADOPTION_VALUE_REVIEW',
          observedAt: now,
          lineageJson: {
            signedOffByAdminId: admin.id,
            reason: reason.slice(0, 2000),
          },
          idempotencyKey: key,
          createdByAdminId: admin.id,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
  }

  return {
    ok: true,
    plan: serializeAdoptionPlan(updated),
    valueReviewState: ADOPTION_VALUE_REVIEW_STATE.SIGNED_OFF,
    domain: getAdoptionDomainContract(),
  };
}

export async function listAdoptionValueOutcomes(prisma, args = {}) {
  const planId = args.planId || args.adoptionPlanId;
  const access = await loadAdoptionPlanForActor(prisma, {
    ...args,
    planId,
    adoptionPlanId: planId,
  });
  if (!access.ok) return access;
  if (!hasCustomerAdoptionValueOutcomeModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_value_outcome_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  const rows = await prisma.customerAdoptionValueOutcome.findMany({
    where: { planId: access.planRow.id },
  });
  return {
    ok: true,
    outcomes: rows.map(serializeAdoptionValueOutcome),
    domain: getAdoptionDomainContract(),
  };
}
