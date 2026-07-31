/**
 * Opportunity timeline — Phase 12 Wave 3.
 * Paginated merge of stage history + CrmTimelineEvent (OPPORTUNITY).
 * Never projects Support/CS threads.
 */

import {
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
  CRM_SUBJECT_TYPE,
} from '../catalogue.js';
import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import {
  appendTimelineEvent,
  hasCrmTimelineEventModel,
} from '../timeline.js';
import {
  hasCrmOpportunityModel,
  hasCrmOpportunityStageHistoryModel,
} from './model.js';

async function loadOpportunity(prisma, opportunityId) {
  const id = opportunityId ? String(opportunityId).trim() : '';
  if (!id || !hasCrmOpportunityModel(prisma)) return null;
  try {
    if (/^OPP-\d{4}-\d{6}$/.test(id)) {
      return await prisma.crmOpportunity.findUnique({ where: { opportunityNumber: id } });
    }
    return await prisma.crmOpportunity.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

function serializeUnifiedEvent(row) {
  return {
    id: row.id,
    source: row.source,
    eventType: row.eventType,
    summary: row.summary || null,
    payload: row.payload ?? null,
    actorAdminId: row.actorAdminId || null,
    at: row.at ? new Date(row.at).toISOString() : null,
    fromStageCode: row.fromStageCode || null,
    toStageCode: row.toStageCode || null,
  };
}

/**
 * Append Opportunity timeline event (best-effort).
 */
export async function appendOpportunityTimelineEvent(prisma, args = {}) {
  return appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.OPPORTUNITY,
    subjectId: args.opportunityId,
    eventType: args.eventType,
    summary: args.summary,
    payload: args.payload,
    actorAdminId: args.actorAdminId,
    at: args.at,
  });
}

/**
 * Paginated Opportunity timeline (stage history + activity events).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   opportunityId: string,
 *   limit?: number|string,
 *   offset?: number|string,
 * }} args
 */
export async function listOpportunityTimeline(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_view_forbidden', items: [] };
  }

  const row = await loadOpportunity(prisma, args.opportunityId);
  if (!row) return { ok: false, notFound: true, error: 'opportunity_not_found', items: [] };

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied', items: [] };
  }

  const rawLimit = Number(args.limit);
  const limit = Math.min(
    CRM_LIST_MAX_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : CRM_LIST_DEFAULT_LIMIT)
  );
  const rawOffset = Number(args.offset);
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  const merged = [];

  if (hasCrmOpportunityStageHistoryModel(prisma)) {
    try {
      const hist = await prisma.crmOpportunityStageHistory.findMany({
        where: { opportunityId: row.id },
        orderBy: { at: 'desc' },
        take: CRM_LIST_MAX_LIMIT,
      });
      for (const h of hist || []) {
        merged.push({
          id: `stage:${h.id}`,
          source: 'STAGE_HISTORY',
          eventType: 'STAGE_CHANGE',
          summary: `Stage ${h.fromStageCode || '—'} → ${h.toStageCode}`,
          payload: {
            historyId: h.id,
            reason: h.reason || null,
            evidenceReferences: h.evidenceReferences ?? null,
            idempotencyKey: h.idempotencyKey || null,
          },
          actorAdminId: h.changedByAdminId || null,
          at: h.at,
          fromStageCode: h.fromStageCode || null,
          toStageCode: h.toStageCode || null,
        });
      }
    } catch {
      // ignore
    }
  }

  if (hasCrmTimelineEventModel(prisma)) {
    try {
      const events = await prisma.crmTimelineEvent.findMany({
        where: {
          subjectType: CRM_SUBJECT_TYPE.OPPORTUNITY,
          subjectId: row.id,
        },
        orderBy: { at: 'desc' },
        take: CRM_LIST_MAX_LIMIT,
      });
      for (const e of events || []) {
        merged.push({
          id: `timeline:${e.id}`,
          source: 'TIMELINE',
          eventType: e.eventType,
          summary: e.summary || null,
          payload: e.payload ?? null,
          actorAdminId: e.actorAdminId || null,
          at: e.at,
          fromStageCode: null,
          toStageCode: null,
        });
      }
    } catch {
      // ignore
    }
  }

  merged.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  const page = merged.slice(offset, offset + limit);

  return {
    ok: true,
    items: page.map(serializeUnifiedEvent),
    meta: {
      count: page.length,
      limit,
      offset,
      totalMerged: merged.length,
      supportThreadProjected: false,
      csThreadProjected: false,
    },
  };
}
