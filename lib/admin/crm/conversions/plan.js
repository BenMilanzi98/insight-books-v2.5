/**
 * Versioned Conversion Plan — Phase 16 Wave 1.
 * Material change → new immutable plan version.
 */

import { createHash } from 'crypto';
import {
  CRM_CONVERSION_WAVE1_STEPS,
  getConversionDomainContract,
} from './catalogue.js';
import {
  hasCrmConversionPlanModel,
  hasCrmConversionPlanVersionModel,
  resolveConversionActor,
  serializeConversionPlan,
  serializeConversionPlanVersion,
} from './model.js';
import { loadConversionRequest } from './requests.js';

function planChecksum(content) {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

/**
 * Create or bump a conversion plan version for a request.
 */
export async function createConversionPlan(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  if (!hasCrmConversionPlanModel(prisma) || !hasCrmConversionPlanVersionModel(prisma)) {
    return {
      ok: false,
      error: 'crm_conversion_plan_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const request = await loadConversionRequest(prisma, args.conversionRequestId);
  if (!request) {
    return { ok: false, notFound: true, error: 'conversion_request_not_found' };
  }

  const now = args.now || new Date();
  let plan = null;
  try {
    plan = await prisma.crmConversionPlan.findUnique({
      where: { conversionRequestId: request.id },
    });
  } catch {
    plan = null;
  }
  if (!plan && request.currentPlanId) {
    try {
      plan = await prisma.crmConversionPlan.findUnique({
        where: { id: request.currentPlanId },
      });
    } catch {
      plan = null;
    }
  }

  if (!plan) {
    plan = await prisma.crmConversionPlan.create({
      data: {
        conversionRequestId: request.id,
        latestVersionNumber: 0,
        currentVersionId: null,
        createdByAdminId: admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  const latest = await prisma.crmConversionPlanVersion.findFirst({
    where: { planId: plan.id },
    orderBy: { versionNumber: 'desc' },
  });

  if (latest && !args.forceNewVersion) {
    return {
      ok: true,
      plan: serializeConversionPlan(plan),
      planVersion: serializeConversionPlanVersion(latest),
      alreadyExists: true,
      domain: getConversionDomainContract(),
    };
  }

  const versionNumber = (latest?.versionNumber || 0) + 1;
  const contentJson = {
    conversionRequestId: request.id,
    requestNumber: request.requestNumber,
    opportunityId: request.opportunityId,
    acceptanceId: request.acceptanceId,
    conversionType: request.conversionType,
    currency: request.currency,
    steps: CRM_CONVERSION_WAVE1_STEPS.map((s) => ({
      stepCode: s.stepCode,
      stepOrder: s.stepOrder,
      wave1Default: s.wave1Default || null,
    })),
    expectedSideEffects: {
      closedWon: true,
      customer: false,
      tenant: false,
      subscription: false,
      invoice: false,
    },
    notes: args.notes || null,
    versionNumber,
  };
  const checksum = planChecksum(contentJson);

  const planVersion = await prisma.crmConversionPlanVersion.create({
    data: {
      planId: plan.id,
      versionNumber,
      planChecksum: checksum,
      contentJson,
      immutable: true,
      notes: args.notes != null ? String(args.notes).trim().slice(0, 2000) : null,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  const updatedPlan = await prisma.crmConversionPlan.update({
    where: { id: plan.id },
    data: {
      latestVersionNumber: versionNumber,
      currentVersionId: planVersion.id,
      updatedAt: now,
    },
  });

  if (typeof prisma.crmConversionRequest?.update === 'function') {
    await prisma.crmConversionRequest.update({
      where: { id: request.id },
      data: { currentPlanId: updatedPlan.id, updatedAt: now },
    });
  }

  return {
    ok: true,
    plan: serializeConversionPlan(updatedPlan),
    planVersion: serializeConversionPlanVersion(planVersion),
    domain: getConversionDomainContract(),
  };
}
