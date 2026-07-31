/**
 * Next-Action honesty evaluator — Phase 13 Wave 1.
 * Do not fabricate next actions. Envelopes: VALID | MISSING | OVERDUE |
 * BLOCKED_BY_CONSENT | UNAVAILABLE.
 */

import {
  CRM_FOLLOW_UP_STATUS,
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
  CRM_NEXT_ACTION_STATUS,
  CRM_SUBJECT_TYPE,
  CRM_TASK_STATUS,
} from './catalogue.js';
import { CRM_OPPORTUNITY_STATUS } from './pipeline/catalogue.js';
import { resolveCrmAccess } from './authz.js';
import { hasCrmTaskModel } from './tasks.js';
import { hasCrmFollowUpModel } from './followUps.js';
import { hasCrmOpportunityModel } from './opportunities/model.js';

const OPEN_TASK = CRM_TASK_STATUS.TODO;
const OPEN_FOLLOW_UPS = [
  CRM_FOLLOW_UP_STATUS.PLANNED,
  CRM_FOLLOW_UP_STATUS.OPEN,
  CRM_FOLLOW_UP_STATUS.BLOCKED_BY_CONSENT,
];

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   subjectType: string,
 *   subjectId: string,
 *   now?: Date,
 * }} args
 */
export async function evaluateNextAction(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewActivities &&
    !access.canViewLeads &&
    !access.canViewOpportunities
  ) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_next_action_view_forbidden',
      status: CRM_NEXT_ACTION_STATUS.UNAVAILABLE,
      nextAction: null,
      fabricated: false,
    };
  }

  const subjectType = String(args.subjectType || '').trim().toUpperCase();
  const subjectId = args.subjectId ? String(args.subjectId).trim() : '';
  if (!subjectType || !subjectId) {
    return {
      ok: false,
      error: 'subjectType_and_subjectId_required',
      status: CRM_NEXT_ACTION_STATUS.UNAVAILABLE,
      nextAction: null,
      fabricated: false,
    };
  }

  const taskOk = hasCrmTaskModel(prisma);
  const fuOk = hasCrmFollowUpModel(prisma);
  if (!taskOk && !fuOk) {
    return {
      ok: true,
      status: CRM_NEXT_ACTION_STATUS.UNAVAILABLE,
      nextAction: null,
      fabricated: false,
      reasons: ['task_and_follow_up_models_unavailable'],
    };
  }

  const now = args.now || new Date();
  const candidates = [];

  if (taskOk) {
    try {
      const tasks = await prisma.crmTask.findMany({
        where: {
          subjectType,
          subjectId,
          status: OPEN_TASK,
        },
        take: 50,
      });
      for (const t of tasks || []) {
        candidates.push({
          kind: 'TASK',
          id: t.id,
          activityId: t.activityId || null,
          title: t.title || null,
          dueAt: t.dueAt ? new Date(t.dueAt) : null,
          status: t.status,
          consentBlocked: false,
        });
      }
    } catch {
      // ignore
    }
  }

  if (fuOk) {
    try {
      const fus = await prisma.crmFollowUp.findMany({
        where: {
          subjectType,
          subjectId,
          status: { in: OPEN_FOLLOW_UPS },
        },
        take: 50,
      });
      for (const f of fus || []) {
        candidates.push({
          kind: 'FOLLOW_UP',
          id: f.id,
          activityId: f.activityId || null,
          title: f.title || null,
          dueAt: f.dueAt ? new Date(f.dueAt) : null,
          status: f.status,
          consentBlocked:
            Boolean(f.consentBlocked) ||
            f.status === CRM_FOLLOW_UP_STATUS.BLOCKED_BY_CONSENT,
        });
      }
    } catch {
      // ignore
    }
  }

  if (candidates.length === 0) {
    return {
      ok: true,
      status: CRM_NEXT_ACTION_STATUS.MISSING,
      nextAction: null,
      fabricated: false,
      subjectType,
      subjectId,
    };
  }

  // Prefer earliest due; null due sorts last among open actions
  candidates.sort((a, b) => {
    if (!a.dueAt && !b.dueAt) return 0;
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return a.dueAt.getTime() - b.dueAt.getTime();
  });

  const nonBlocked = candidates.filter((c) => !c.consentBlocked);
  const blockedOnly = nonBlocked.length === 0;

  if (blockedOnly) {
    const blocked = candidates[0];
    return {
      ok: true,
      status: CRM_NEXT_ACTION_STATUS.BLOCKED_BY_CONSENT,
      nextAction: {
        kind: blocked.kind,
        id: blocked.id,
        activityId: blocked.activityId,
        title: blocked.title,
        dueAt: blocked.dueAt ? blocked.dueAt.toISOString() : null,
        status: blocked.status,
      },
      fabricated: false,
      subjectType,
      subjectId,
    };
  }

  const next = nonBlocked[0];
  const overdue = Boolean(next.dueAt && next.dueAt.getTime() < now.getTime());

  return {
    ok: true,
    status: overdue
      ? CRM_NEXT_ACTION_STATUS.OVERDUE
      : CRM_NEXT_ACTION_STATUS.VALID,
    nextAction: {
      kind: next.kind,
      id: next.id,
      activityId: next.activityId,
      title: next.title,
      dueAt: next.dueAt ? next.dueAt.toISOString() : null,
      status: next.status,
    },
    fabricated: false,
    subjectType,
    subjectId,
  };
}

/**
 * Open Opportunities with no open Task/Follow-Up next action (MISSING only).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, limit?: number|string, now?: Date }} args
 */
export async function listNoNextActionOpportunities(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewOpportunities && !access.canViewActivities) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_opportunity_view_forbidden',
      items: [],
    };
  }

  if (!hasCrmOpportunityModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: {
        unavailable: true,
        reason: 'crm_opportunity_model_unavailable',
        count: 0,
        fabricated: false,
      },
    };
  }

  const rawLimit = Number(args.limit);
  const limit = Math.min(
    CRM_LIST_MAX_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : CRM_LIST_DEFAULT_LIMIT)
  );
  const now = args.now || new Date();

  let opportunities = [];
  try {
    opportunities = await prisma.crmOpportunity.findMany({
      where: {
        status: CRM_OPPORTUNITY_STATUS.OPEN,
        mergedIntoOpportunityId: null,
      },
      take: Math.min(CRM_LIST_MAX_LIMIT, limit * 4),
    });
  } catch {
    opportunities = [];
  }

  const items = [];
  for (const opp of opportunities || []) {
    const evalResult = await evaluateNextAction(prisma, {
      admin: args.admin,
      subjectType: CRM_SUBJECT_TYPE.OPPORTUNITY,
      subjectId: opp.id,
      now,
    });
    if (evalResult.status === CRM_NEXT_ACTION_STATUS.MISSING) {
      items.push({
        id: opp.id,
        opportunityNumber: opp.opportunityNumber || null,
        title: opp.title || null,
        stageCode: opp.stageCode || null,
        status: opp.status || null,
        nextActionStatus: CRM_NEXT_ACTION_STATUS.MISSING,
        fabricated: false,
      });
    }
    if (items.length >= limit) break;
  }

  return {
    ok: true,
    items,
    meta: { count: items.length, limit, fabricated: false },
  };
}

/**
 * Lead variant — list Leads with MISSING next action (optional natural helper).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, leadIds?: string[], limit?: number|string, now?: Date }} args
 */
export async function listNoNextActionLeads(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewLeads && !access.canViewActivities) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_lead_view_forbidden',
      items: [],
    };
  }

  const leadIds = Array.isArray(args.leadIds) ? args.leadIds.map(String) : [];
  if (leadIds.length === 0) {
    return {
      ok: true,
      items: [],
      meta: { count: 0, note: 'leadIds_required_for_evaluation', fabricated: false },
    };
  }

  const now = args.now || new Date();
  const items = [];
  for (const leadId of leadIds) {
    const evalResult = await evaluateNextAction(prisma, {
      admin: args.admin,
      subjectType: CRM_SUBJECT_TYPE.LEAD,
      subjectId: leadId,
      now,
    });
    if (evalResult.status === CRM_NEXT_ACTION_STATUS.MISSING) {
      items.push({
        id: leadId,
        nextActionStatus: CRM_NEXT_ACTION_STATUS.MISSING,
        fabricated: false,
      });
    }
  }

  return {
    ok: true,
    items,
    meta: { count: items.length, fabricated: false },
  };
}

export { CRM_NEXT_ACTION_STATUS };
