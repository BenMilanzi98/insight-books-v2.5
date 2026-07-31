/**
 * CRM automation rule model + SoD approval — Phase 13 Wave 4.
 * Requester ≠ approver. Small approved trigger set only.
 */

import {
  CRM_AUTOMATION_RULE_STATUS,
  CRM_AUTOMATION_TRIGGERS,
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import {
  APPROVED_TRIGGER_ACTIONS,
  CRM_AUTOMATION_ACTION,
  CRM_AUTOMATION_ACTIONS,
  CRM_AUTOMATION_DEFINITION_VERSION,
} from './catalogue.js';

const TRIGGER_SET = new Set(CRM_AUTOMATION_TRIGGERS);
const ACTION_SET = new Set(CRM_AUTOMATION_ACTIONS);

export function hasCrmAutomationRuleModel(prisma) {
  return typeof prisma?.crmAutomationRule?.create === 'function';
}

export function hasCrmAutomationApprovalModel(prisma) {
  return typeof prisma?.crmAutomationApproval?.create === 'function';
}

function serializeRule(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name || null,
    trigger: row.trigger,
    action: row.action,
    status: row.status,
    configJson: row.configJson ?? null,
    requestedByAdminId: row.requestedByAdminId || null,
    approvedByAdminId: row.approvedByAdminId || null,
    approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    definitionVersion: CRM_AUTOMATION_DEFINITION_VERSION,
  };
}

function isApprovedPair(trigger, action) {
  const allowed = APPROVED_TRIGGER_ACTIONS[trigger] || [];
  return allowed.includes(action);
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   code: string,
 *   name?: string,
 *   trigger: string,
 *   action: string,
 *   configJson?: object|null,
 *   now?: Date,
 * }} args
 */
export async function createAutomationRule(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canEditActivities && !access.canEditLeads && !access.isSuperAdmin) {
    return { ok: false, forbidden: true, reason: 'crm_automation_rule_forbidden' };
  }

  if (!hasCrmAutomationRuleModel(prisma)) {
    return {
      ok: false,
      error: 'crm_automation_rule_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const code = args.code ? String(args.code).trim().toUpperCase() : '';
  if (!code || !/^[A-Z][A-Z0-9_]{1,63}$/.test(code)) {
    return { ok: false, error: 'invalid_rule_code' };
  }

  const trigger = String(args.trigger || '').trim().toUpperCase();
  const action = String(args.action || '').trim().toUpperCase();
  if (!TRIGGER_SET.has(trigger)) {
    return { ok: false, error: 'invalid_trigger', allowed: CRM_AUTOMATION_TRIGGERS };
  }
  if (!ACTION_SET.has(action)) {
    return { ok: false, error: 'invalid_action', allowed: CRM_AUTOMATION_ACTIONS };
  }
  if (!isApprovedPair(trigger, action)) {
    return {
      ok: false,
      error: 'trigger_action_not_in_approved_set',
      allowedForTrigger: APPROVED_TRIGGER_ACTIONS[trigger] || [],
    };
  }

  const now = args.now || new Date();
  const row = await prisma.crmAutomationRule.create({
    data: {
      code,
      name: args.name != null ? String(args.name).trim().slice(0, 200) : null,
      trigger,
      action,
      status: CRM_AUTOMATION_RULE_STATUS.DRAFT,
      configJson: args.configJson ?? null,
      requestedByAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    rule: serializeRule(row),
    meta: {
      sodRequired: true,
      sequencesForbidden: true,
      arbitraryCodeForbidden: true,
      definitionVersion: CRM_AUTOMATION_DEFINITION_VERSION,
    },
  };
}

/**
 * Request approval (DRAFT → PENDING_APPROVAL).
 */
export async function requestAutomationApproval(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canEditActivities && !access.canEditLeads && !access.isSuperAdmin) {
    return { ok: false, forbidden: true, reason: 'crm_automation_request_forbidden' };
  }

  if (!hasCrmAutomationRuleModel(prisma)) {
    return {
      ok: false,
      error: 'crm_automation_rule_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const ruleId = args.ruleId ? String(args.ruleId).trim() : '';
  if (!ruleId) return { ok: false, error: 'ruleId_required' };

  let row = null;
  try {
    row = await prisma.crmAutomationRule.findUnique({ where: { id: ruleId } });
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'rule_not_found' };

  if (
    row.status !== CRM_AUTOMATION_RULE_STATUS.DRAFT &&
    row.status !== CRM_AUTOMATION_RULE_STATUS.REJECTED
  ) {
    return { ok: false, error: 'rule_not_requestable', status: row.status };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmAutomationRule.update({
    where: { id: ruleId },
    data: {
      status: CRM_AUTOMATION_RULE_STATUS.PENDING_APPROVAL,
      requestedByAdminId: args.admin?.id || row.requestedByAdminId,
      updatedAt: now,
    },
  });

  if (hasCrmAutomationApprovalModel(prisma)) {
    try {
      await prisma.crmAutomationApproval.create({
        data: {
          ruleId,
          action: 'REQUEST',
          actorAdminId: args.admin?.id || null,
          at: now,
        },
      });
    } catch {
      // audit best-effort
    }
  }

  return { ok: true, rule: serializeRule(updated), meta: { sodRequired: true } };
}

/**
 * Approve rule — SoD: approver ≠ requester.
 */
export async function approveAutomationRule(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canEditActivities && !access.canApproveMerge && !access.isSuperAdmin) {
    return { ok: false, forbidden: true, reason: 'crm_automation_approve_forbidden' };
  }

  if (!hasCrmAutomationRuleModel(prisma)) {
    return {
      ok: false,
      error: 'crm_automation_rule_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const ruleId = args.ruleId ? String(args.ruleId).trim() : '';
  if (!ruleId) return { ok: false, error: 'ruleId_required' };

  let row = null;
  try {
    row = await prisma.crmAutomationRule.findUnique({ where: { id: ruleId } });
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'rule_not_found' };

  if (row.status !== CRM_AUTOMATION_RULE_STATUS.PENDING_APPROVAL) {
    return { ok: false, error: 'rule_not_pending_approval', status: row.status };
  }

  const approverId = args.admin?.id ? String(args.admin.id) : '';
  const requesterId = row.requestedByAdminId ? String(row.requestedByAdminId) : '';
  if (!approverId) return { ok: false, error: 'approver_required' };
  if (requesterId && approverId === requesterId) {
    return {
      ok: false,
      error: 'automation_self_approval_blocked',
      reason: 'sod_requester_must_differ_from_approver',
    };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmAutomationRule.update({
    where: { id: ruleId },
    data: {
      status: CRM_AUTOMATION_RULE_STATUS.APPROVED,
      approvedByAdminId: approverId,
      approvedAt: now,
      updatedAt: now,
    },
  });

  if (hasCrmAutomationApprovalModel(prisma)) {
    try {
      await prisma.crmAutomationApproval.create({
        data: {
          ruleId,
          action: 'APPROVE',
          actorAdminId: approverId,
          at: now,
        },
      });
    } catch {
      // audit best-effort
    }
  }

  return {
    ok: true,
    rule: serializeRule(updated),
    meta: { sodEnforced: true, selfApprovalBlocked: true },
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, status?: string, limit?: number|string }} args
 */
export async function listAutomationRules(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewActivities &&
    !access.canViewLeads &&
    !access.canViewOpportunities
  ) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_automation_list_forbidden',
      items: [],
    };
  }

  if (!hasCrmAutomationRuleModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: {
        unavailable: true,
        reason: 'crm_automation_rule_model_unavailable',
        status: 'UNAVAILABLE',
      },
    };
  }

  const where = {};
  if (args.status) where.status = String(args.status).trim().toUpperCase();

  const limit = Math.min(
    CRM_LIST_MAX_LIMIT,
    Math.max(1, Number(args.limit) || CRM_LIST_DEFAULT_LIMIT)
  );

  let rows = [];
  try {
    rows = await prisma.crmAutomationRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } catch {
    rows = [];
  }

  return {
    ok: true,
    items: (rows || []).map(serializeRule),
    meta: {
      count: (rows || []).length,
      approvedTriggers: CRM_AUTOMATION_TRIGGERS,
      sequencesForbidden: true,
      definitionVersion: CRM_AUTOMATION_DEFINITION_VERSION,
    },
  };
}

export { serializeRule, isApprovedPair, CRM_AUTOMATION_ACTION };
