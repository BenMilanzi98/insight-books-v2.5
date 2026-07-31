/**
 * Wave 3 — Activation policy service.
 * Closed Won ≠ ACTIVE. ACTIVE only when policy prerequisites pass.
 */

import {
  CRM_ACTIVATION_POLICY,
  CRM_CONVERSION_RESOURCE_TYPE,
  CRM_SUBSCRIPTION_PROVISION_STATUS,
} from './catalogue.js';
import { resolveConversionActor } from './model.js';
import { isSuccessfulPaymentStatus } from '../../platformBilling.js';
import { ENTITLEMENT_STATUSES } from '../../featureEntitlements.js';

function hasSubscriptionModel(prisma) {
  return typeof prisma?.accountSubscription?.update === 'function';
}

function hasActivationAttemptModel(prisma) {
  return typeof prisma?.crmConversionActivationAttempt?.create === 'function';
}

function normalizePolicy(policyVersionId) {
  const raw = String(policyVersionId || CRM_ACTIVATION_POLICY.MANUAL)
    .trim()
    .toUpperCase();
  if (Object.values(CRM_ACTIVATION_POLICY).includes(raw)) return raw;
  // Allow version-like ids that embed policy code
  for (const code of Object.values(CRM_ACTIVATION_POLICY)) {
    if (raw.includes(code)) return code;
  }
  return raw;
}

function evidenceFlag(evidence, key) {
  if (!evidence || typeof evidence !== 'object') return false;
  return Boolean(evidence[key]);
}

function isAuthoritativePaidStatus(status) {
  const s = String(status || '').toUpperCase();
  return isSuccessfulPaymentStatus(s) || s === 'PAID';
}

/**
 * Resolve AFTER_PAYMENT truth from Payment / initiation records only.
 * Caller booleans (paymentSuccessful / paymentCompleted) are never trusted.
 */
export async function resolveAuthoritativePaymentSuccess(prisma, evidence = {}) {
  const paymentId = evidence.paymentId ? String(evidence.paymentId).trim() : '';
  const invoiceId = evidence.invoiceId ? String(evidence.invoiceId).trim() : '';

  if (paymentId && typeof prisma?.platformPayment?.findUnique === 'function') {
    const pay = await prisma.platformPayment.findUnique({
      where: { id: paymentId },
    });
    if (pay && isAuthoritativePaidStatus(pay.status)) {
      return { ok: true, paymentId: pay.id, status: String(pay.status) };
    }
    // Explicit paymentId that is missing or not paid → fail closed
    return { ok: false, paymentId, status: pay?.status || null };
  }

  if (invoiceId && typeof prisma?.platformPayment?.findMany === 'function') {
    const pays = await prisma.platformPayment.findMany({
      where: { invoiceId },
    });
    const paid = (pays || []).find((p) => isAuthoritativePaidStatus(p.status));
    if (paid) {
      return { ok: true, paymentId: paid.id, status: String(paid.status) };
    }
  } else if (invoiceId && typeof prisma?.platformPayment?.findFirst === 'function') {
    const pay = await prisma.platformPayment.findFirst({
      where: { invoiceId },
    });
    if (pay && isAuthoritativePaidStatus(pay.status)) {
      return { ok: true, paymentId: pay.id, status: String(pay.status) };
    }
  }

  return { ok: false, paymentId: null, status: null };
}

async function resolveScopedEntitlementIds(prisma, {
  conversionId = null,
  entitlementIds = null,
} = {}) {
  if (Array.isArray(entitlementIds) && entitlementIds.length) {
    return entitlementIds.map((id) => String(id));
  }
  if (
    conversionId &&
    typeof prisma?.crmConversionResource?.findFirst === 'function'
  ) {
    const res = await prisma.crmConversionResource.findFirst({
      where: {
        conversionId: String(conversionId),
        resourceType: CRM_CONVERSION_RESOURCE_TYPE.ENTITLEMENT_SET,
      },
    });
    const ids = res?.metaJson?.entitlementIds;
    if (Array.isArray(ids) && ids.length) {
      return ids.map((id) => String(id));
    }
  }
  // Fail closed: never promote all tenant PENDING entitlements
  return [];
}

async function upsertActivationAttempt(prisma, {
  prior = null,
  data,
}) {
  if (prior?.id && typeof prisma.crmConversionActivationAttempt.update === 'function') {
    return prisma.crmConversionActivationAttempt.update({
      where: { id: prior.id },
      data: {
        policy: data.policy,
        activationPolicyVersionId: data.activationPolicyVersionId,
        ok: data.ok,
        activated: data.activated,
        status: data.status,
        errorCode: data.errorCode ?? null,
        evidenceJson: data.evidenceJson,
        actorAdminId: data.actorAdminId,
      },
    });
  }
  if (prior?.id) {
    // In-memory / limited clients: mutate then return
    Object.assign(prior, {
      policy: data.policy,
      activationPolicyVersionId: data.activationPolicyVersionId,
      ok: data.ok,
      activated: data.activated,
      status: data.status,
      errorCode: data.errorCode ?? null,
      evidenceJson: data.evidenceJson,
      actorAdminId: data.actorAdminId,
    });
    return prior;
  }
  return prisma.crmConversionActivationAttempt.create({ data });
}

/**
 * Evaluate whether activation prerequisites are satisfied for a policy.
 * AFTER_PAYMENT requires evidence.paymentVerified from authoritative lookup —
 * bare paymentSuccessful / paymentCompleted booleans are ignored.
 */
export function evaluateActivationPolicy({ policy, evidence = {} }) {
  const code = normalizePolicy(policy);
  switch (code) {
    case CRM_ACTIVATION_POLICY.IMMEDIATE:
      return { ok: true, policy: code };
    case CRM_ACTIVATION_POLICY.AFTER_INVOICE:
      if (!evidenceFlag(evidence, 'invoiceIssued') && !evidenceFlag(evidence, 'invoiceId')) {
        return {
          ok: false,
          error: 'activation_blocked_invoice_required',
          policy: code,
        };
      }
      return { ok: true, policy: code };
    case CRM_ACTIVATION_POLICY.AFTER_PAYMENT: {
      // Only paymentVerified (set after DB lookup) counts — never caller booleans
      if (!evidenceFlag(evidence, 'paymentVerified')) {
        return {
          ok: false,
          error: 'activation_blocked_payment_required',
          policy: code,
        };
      }
      return { ok: true, policy: code };
    }
    case CRM_ACTIVATION_POLICY.SERVICE_DATE: {
      const serviceDate = evidence.serviceDate || evidence.activationDate;
      if (!serviceDate) {
        return {
          ok: false,
          error: 'activation_blocked_service_date_required',
          policy: code,
        };
      }
      const when = new Date(serviceDate);
      const now = evidence.now ? new Date(evidence.now) : new Date();
      if (Number.isNaN(when.getTime()) || when.getTime() > now.getTime()) {
        return {
          ok: false,
          error: 'activation_blocked_service_date_not_reached',
          policy: code,
        };
      }
      return { ok: true, policy: code };
    }
    case CRM_ACTIVATION_POLICY.MANUAL:
      if (!evidenceFlag(evidence, 'manualApproval')) {
        return {
          ok: false,
          error: 'activation_blocked_manual_approval_required',
          policy: code,
        };
      }
      return { ok: true, policy: code };
    default:
      return {
        ok: false,
        error: 'activation_policy_unknown',
        policy: code,
        status: 'NOT_AVAILABLE',
      };
  }
}

/**
 * Activate a provisioned (pending) subscription when policy allows.
 * Idempotent on exact idempotencyKey for *successful* activations only.
 * Blocked/deferred attempts do not poison the key — evidence may change later.
 */
export async function activateProvisionedSubscription(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const subscriptionId = args.subscriptionId
    ? String(args.subscriptionId).trim()
    : '';
  const policyVersionId =
    args.activationPolicyVersionId || args.policy || CRM_ACTIVATION_POLICY.MANUAL;
  const evidence = args.evidence || {};
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  const now = args.now || new Date();
  const conversionId = args.conversionId ? String(args.conversionId) : null;

  if (!subscriptionId) {
    return { ok: false, error: 'subscriptionId_required' };
  }
  if (!idempotencyKey) {
    return { ok: false, error: 'idempotencyKey_required' };
  }
  if (!hasSubscriptionModel(prisma)) {
    return {
      ok: false,
      error: 'subscription_model_unavailable',
      status: 'NOT_AVAILABLE',
      activated: false,
    };
  }

  let priorAttempt = null;
  if (hasActivationAttemptModel(prisma)) {
    priorAttempt = await prisma.crmConversionActivationAttempt.findFirst({
      where: { subscriptionId, idempotencyKey },
    });
    // Only successful activations short-circuit; blocked rows stay re-evaluable
    if (priorAttempt && priorAttempt.activated === true) {
      return {
        ok: true,
        activated: true,
        subscriptionId,
        status: priorAttempt.status || 'ACTIVE',
        idempotentReplay: true,
        error: null,
        policy: priorAttempt.policy || normalizePolicy(policyVersionId),
      };
    }
  }

  const policyCode = normalizePolicy(policyVersionId);
  let evidenceForEval = { ...evidence, now };

  if (policyCode === CRM_ACTIVATION_POLICY.AFTER_PAYMENT) {
    const paymentTruth = await resolveAuthoritativePaymentSuccess(prisma, evidence);
    evidenceForEval = {
      ...evidenceForEval,
      paymentVerified: paymentTruth.ok === true,
      // Do not let caller booleans influence policy
      paymentSuccessful: undefined,
      paymentCompleted: undefined,
    };
  }

  const policyEval = evaluateActivationPolicy({
    policy: policyVersionId,
    evidence: evidenceForEval,
  });

  if (!policyEval.ok) {
    if (hasActivationAttemptModel(prisma)) {
      await upsertActivationAttempt(prisma, {
        prior: priorAttempt,
        data: {
          subscriptionId,
          policy: policyEval.policy,
          activationPolicyVersionId: String(policyVersionId),
          ok: false,
          activated: false,
          status: 'BLOCKED',
          errorCode: policyEval.error,
          evidenceJson: evidence,
          idempotencyKey,
          actorAdminId: admin?.id || null,
          createdAt: now,
        },
      });
    }
    return {
      ok: false,
      error: policyEval.error,
      activated: false,
      subscriptionId,
      policy: policyEval.policy,
      reevaluable: true,
    };
  }

  const sub = await prisma.accountSubscription.findUnique({
    where: { id: subscriptionId },
  });
  if (!sub) {
    return { ok: false, error: 'subscription_not_found', activated: false };
  }

  if (sub.isActive && String(sub.status).toUpperCase() === 'ACTIVE') {
    if (hasActivationAttemptModel(prisma)) {
      await upsertActivationAttempt(prisma, {
        prior: priorAttempt,
        data: {
          subscriptionId,
          policy: policyEval.policy,
          activationPolicyVersionId: String(policyVersionId),
          ok: true,
          activated: true,
          status: 'ACTIVE',
          errorCode: null,
          evidenceJson: evidence,
          idempotencyKey,
          actorAdminId: admin?.id || null,
          createdAt: now,
        },
      });
    }
    return {
      ok: true,
      activated: true,
      alreadyActive: true,
      subscriptionId,
      status: 'ACTIVE',
      policy: policyEval.policy,
      idempotentReplay: true,
    };
  }

  const updated = await prisma.accountSubscription.update({
    where: { id: subscriptionId },
    data: {
      isActive: true,
      status: 'ACTIVE',
      startedAt: now,
      updatedAt: now,
    },
  });

  // Promote only this conversion / subscription's pending entitlements
  if (
    updated.tenantId &&
    typeof prisma?.platformFeatureEntitlement?.findMany === 'function'
  ) {
    const scopedIds = await resolveScopedEntitlementIds(prisma, {
      conversionId,
      entitlementIds: args.entitlementIds,
    });
    if (scopedIds.length) {
      const pending = await prisma.platformFeatureEntitlement.findMany({
        where: {
          tenantId: updated.tenantId,
          id: { in: scopedIds },
        },
      });
      for (const ent of pending) {
        if (ent.status === ENTITLEMENT_STATUSES.PENDING) {
          await prisma.platformFeatureEntitlement.update({
            where: { id: ent.id },
            data: {
              status: ENTITLEMENT_STATUSES.ACTIVE,
              startDate: now,
              updatedAt: now,
            },
          });
        }
      }
    }
  }

  if (hasActivationAttemptModel(prisma)) {
    await upsertActivationAttempt(prisma, {
      prior: priorAttempt,
      data: {
        subscriptionId,
        policy: policyEval.policy,
        activationPolicyVersionId: String(policyVersionId),
        ok: true,
        activated: true,
        status: 'ACTIVE',
        errorCode: null,
        evidenceJson: evidence,
        idempotencyKey,
        actorAdminId: admin?.id || null,
        createdAt: now,
      },
    });
  }

  return {
    ok: true,
    activated: true,
    subscriptionId,
    status: updated.status,
    isActive: true,
    policy: policyEval.policy,
    priorStatus: CRM_SUBSCRIPTION_PROVISION_STATUS.PENDING_ACTIVATION,
  };
}
