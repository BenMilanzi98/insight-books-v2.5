/**
 * Conversion dry-run — Phase 16 Wave 1.
 * Zero operational side effects: no Customer/Tenant/Subscription/Invoice/invite/handoff;
 * no Opportunity stage change; no CrmConversion create.
 * May write an auditable preview record only.
 */

import { getConversionDomainContract } from './catalogue.js';
import {
  hasCrmConversionDryRunModel,
  hasCrmConversionPlanVersionModel,
  resolveConversionActor,
  serializeConversionPlanVersion,
  serializeConversionRequest,
} from './model.js';
import { loadConversionRequest } from './requests.js';
import { evaluateConversionRequestReadiness } from './readiness.js';

/**
 * Preview conversion plan outcomes without mutating operational domains.
 */
export async function dryRunConversion(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const request = await loadConversionRequest(prisma, args.conversionRequestId);
  if (!request) {
    return { ok: false, notFound: true, error: 'conversion_request_not_found' };
  }

  if (!hasCrmConversionPlanVersionModel(prisma)) {
    return {
      ok: false,
      error: 'crm_conversion_plan_version_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const planVersionId = args.conversionPlanVersionId
    ? String(args.conversionPlanVersionId).trim()
    : '';
  if (!planVersionId) {
    return { ok: false, error: 'conversionPlanVersionId_required' };
  }

  const planVersion = await prisma.crmConversionPlanVersion.findUnique({
    where: { id: planVersionId },
  });
  if (!planVersion) {
    return { ok: false, notFound: true, error: 'conversion_plan_version_not_found' };
  }

  const readiness = await evaluateConversionRequestReadiness(prisma, {
    conversionRequestId: request.id,
    admin,
    actorContext: args.actorContext,
  });

  const preview = {
    conversionRequestId: request.id,
    requestNumber: request.requestNumber,
    opportunityId: request.opportunityId,
    acceptanceId: request.acceptanceId,
    planVersionId: planVersion.id,
    planChecksum: planVersion.planChecksum,
    createVsLink: {
      customer: 'DEFERRED_WAVE_2',
      tenant: 'DEFERRED_WAVE_2',
      subscription: 'DEFERRED_WAVE_3',
      invoice: 'DEFERRED_WAVE_3',
    },
    expectedClosedWon: true,
    closedWonApplied: false,
    blockers: readiness.ok ? [] : readiness.checklist?.filter((c) => !c.ok) || [],
    warnings: [
      'Wave 1 dry-run: provision steps not executed',
      'Closed Won only applied on durable execute',
    ],
  };

  const now = args.now || new Date();
  let dryRunRecord = null;
  if (hasCrmConversionDryRunModel(prisma)) {
    dryRunRecord = await prisma.crmConversionDryRun.create({
      data: {
        conversionRequestId: request.id,
        conversionPlanVersionId: planVersion.id,
        previewJson: preview,
        createdByAdminId: admin?.id || null,
        createdAt: now,
      },
    });
  }

  // Explicit honesty — no operational creates; Opp stage untouched
  return {
    ok: true,
    preview,
    dryRunId: dryRunRecord?.id || null,
    request: serializeConversionRequest(request),
    planVersion: serializeConversionPlanVersion(planVersion),
    readiness,
    customerCreated: false,
    tenantCreated: false,
    subscriptionCreated: false,
    invoiceCreated: false,
    inviteCreated: false,
    handoffCreated: false,
    opportunityStageMutated: false,
    conversionCreated: false,
    domain: getConversionDomainContract(),
  };
}
