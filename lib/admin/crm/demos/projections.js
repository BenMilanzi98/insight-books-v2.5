/**
 * Thin Opportunity / Lead Demo projections — Phase 14 Wave 1.
 * Read-only lists; never mutates Opportunity stage / probability / close-date.
 */

import { resolveCrmAccess } from '../authz.js';
import { hasCrmDemoModel, hasCrmDemoRequestModel, serializeDemo, serializeDemoRequest } from './model.js';

function canView(access) {
  return (
    access.canViewActivities ||
    access.canViewLeads ||
    access.canViewOpportunities ||
    access.canView
  );
}

/**
 * Project Demos linked to a Lead (read-only).
 */
export async function listDemosForLead(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canView(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_projection_forbidden' };
  }
  const leadId = args.leadId ? String(args.leadId).trim() : '';
  if (!leadId) return { ok: false, error: 'leadId_required' };
  if (!hasCrmDemoModel(prisma)) {
    return { ok: false, error: 'crm_demo_model_unavailable', status: 'UNAVAILABLE' };
  }

  let demos = [];
  let requests = [];
  try {
    demos = await prisma.crmDemo.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    if (hasCrmDemoRequestModel(prisma)) {
      requests = await prisma.crmDemoRequest.findMany({
        where: { leadId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }
  } catch (err) {
    return { ok: false, error: err?.message || 'demo_lead_projection_failed' };
  }

  return {
    ok: true,
    leadId,
    demos: demos.map(serializeDemo),
    requests: requests.map(serializeDemoRequest),
    opportunityStageMutated: false,
    proposalCreated: false,
  };
}

/**
 * Project Demos linked to an Opportunity (read-only).
 */
export async function listDemosForOpportunity(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canView(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_projection_forbidden' };
  }
  const opportunityId = args.opportunityId
    ? String(args.opportunityId).trim()
    : '';
  if (!opportunityId) return { ok: false, error: 'opportunityId_required' };
  if (!hasCrmDemoModel(prisma)) {
    return { ok: false, error: 'crm_demo_model_unavailable', status: 'UNAVAILABLE' };
  }

  let demos = [];
  let requests = [];
  try {
    demos = await prisma.crmDemo.findMany({
      where: { opportunityId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    if (hasCrmDemoRequestModel(prisma)) {
      requests = await prisma.crmDemoRequest.findMany({
        where: { opportunityId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }
  } catch (err) {
    return { ok: false, error: err?.message || 'demo_opportunity_projection_failed' };
  }

  return {
    ok: true,
    opportunityId,
    demos: demos.map(serializeDemo),
    requests: requests.map(serializeDemoRequest),
    opportunityStageMutated: false,
    probabilityMutated: false,
    closeDateMutated: false,
    proposalCreated: false,
  };
}
