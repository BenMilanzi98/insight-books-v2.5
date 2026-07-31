/**
 * Get Opportunity — Phase 12 Wave 1.
 */

import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import { CRM_OPPORTUNITY_NUMBER_RE } from '../pipeline/catalogue.js';
import { hasCrmOpportunityModel, serializeOpportunity } from './model.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, id: string }} args
 */
export async function getOpportunity(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_view_forbidden' };
  }

  if (!hasCrmOpportunityModel(prisma)) {
    return {
      ok: false,
      error: 'crm_opportunity_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied' };
  }

  const id = args.id ? String(args.id).trim() : '';
  if (!id) return { ok: false, error: 'id_required' };

  let row = null;
  try {
    if (CRM_OPPORTUNITY_NUMBER_RE.test(id)) {
      row = await prisma.crmOpportunity.findUnique({
        where: { opportunityNumber: id },
      });
    } else {
      row = await prisma.crmOpportunity.findUnique({ where: { id } });
    }
  } catch {
    row = null;
  }

  if (!row) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  let stageHistory = [];
  if (typeof prisma.crmOpportunityStageHistory?.findMany === 'function') {
    try {
      stageHistory = await prisma.crmOpportunityStageHistory.findMany({
        where: { opportunityId: row.id },
      });
    } catch {
      stageHistory = [];
    }
  }

  return {
    ok: true,
    opportunity: serializeOpportunity(row),
    stageHistory: (stageHistory || []).map((h) => ({
      id: h.id,
      fromStageCode: h.fromStageCode || null,
      toStageCode: h.toStageCode,
      reason: h.reason || null,
      changedByAdminId: h.changedByAdminId || null,
      idempotencyKey: h.idempotencyKey || null,
      at: h.at ? new Date(h.at).toISOString() : null,
    })),
    meta: {
      scopeMode: scope.mode,
      scopeStub: scope.stub === true,
      weightedUiEnabled: false,
    },
  };
}
