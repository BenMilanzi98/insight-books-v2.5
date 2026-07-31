/**
 * List Opportunities — Phase 12 Wave 1.
 */

import {
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
} from '../catalogue.js';
import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import { hasCrmOpportunityModel, serializeOpportunity } from './model.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   stageCode?: string,
 *   leadId?: string,
 *   ownerAdminId?: string,
 *   myPipeline?: boolean,
 *   status?: string,
 *   limit?: string|number,
 *   offset?: string|number,
 * }} args
 */
export async function listOpportunities(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewOpportunities && !access.canViewPipeline) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_view_forbidden' };
  }

  if (!hasCrmOpportunityModel(prisma)) {
    return {
      ok: false,
      error: 'crm_opportunity_model_unavailable',
      status: 'UNAVAILABLE',
      items: [],
    };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied', items: [] };
  }

  let limit = Number.parseInt(String(args.limit ?? CRM_LIST_DEFAULT_LIMIT), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = CRM_LIST_DEFAULT_LIMIT;
  if (limit > CRM_LIST_MAX_LIMIT) limit = CRM_LIST_MAX_LIMIT;

  let offset = Number.parseInt(String(args.offset ?? 0), 10);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  const where = {};
  if (args.stageCode) where.stageCode = String(args.stageCode).trim().toUpperCase();
  if (args.leadId) where.leadId = String(args.leadId).trim();
  if (args.status) where.status = String(args.status).trim().toUpperCase();
  if (args.myPipeline === true && args.admin?.id) {
    where.ownerAdminId = String(args.admin.id);
  } else if (args.ownerAdminId) {
    where.ownerAdminId = String(args.ownerAdminId).trim();
  }

  let rows = [];
  try {
    rows = await prisma.crmOpportunity.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    rows = [];
  }

  return {
    ok: true,
    items: (rows || []).map(serializeOpportunity),
    meta: {
      count: (rows || []).length,
      limit,
      offset,
      scopeMode: scope.mode,
      scopeStub: scope.stub === true,
      weightedUiEnabled: false,
    },
  };
}
