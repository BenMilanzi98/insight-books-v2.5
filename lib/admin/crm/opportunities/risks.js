/**
 * Opportunity risk signals — Phase 12 Wave 3.
 * Deterministic, evidence-based; ≠ Support/CS health; no invented scores.
 */

import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import { hasCrmOpportunityContactRoleModel, hasPrimaryContactRole } from './contacts.js';
import { hasCrmOpportunityModel, serializeOpportunity } from './model.js';
import { hasCrmOpportunityProductModel } from './products.js';
import { hasCrmTaskModel } from '../tasks.js';
import { CRM_SUBJECT_TYPE, CRM_TASK_STATUS } from '../catalogue.js';

export const CRM_OPPORTUNITY_RISK_SEVERITY = Object.freeze({
  INFO: 'INFO',
  WARN: 'WARN',
  CRITICAL: 'CRITICAL',
});

export const CRM_OPPORTUNITY_RISK_STATUS = Object.freeze({
  OPEN: 'OPEN',
  MITIGATED: 'MITIGATED',
  ACCEPTED: 'ACCEPTED',
  CLOSED: 'CLOSED',
});

export const CRM_OPPORTUNITY_RISK_CODE = Object.freeze({
  MISSING_PRIMARY_CONTACT: 'MISSING_PRIMARY_CONTACT',
  MISSING_COMMERCIAL: 'MISSING_COMMERCIAL',
  MISSING_PRODUCTS: 'MISSING_PRODUCTS',
  STALE_EXPECTED_CLOSE: 'STALE_EXPECTED_CLOSE',
  CLOSE_DATE_UNKNOWN: 'CLOSE_DATE_UNKNOWN',
  MISSING_OWNER: 'MISSING_OWNER',
  OPEN_OVERDUE_TASKS: 'OPEN_OVERDUE_TASKS',
});

export function hasCrmOpportunityRiskModel(prisma) {
  return typeof prisma?.crmOpportunityRisk?.findMany === 'function';
}

function serializeRisk(row) {
  if (!row) return null;
  return {
    id: row.id,
    opportunityId: row.opportunityId,
    code: row.code,
    severity: row.severity,
    status: row.status,
    detail: row.detail || null,
    signalSource: row.signalSource || 'DETERMINISTIC',
    evidenceJson: row.evidenceJson ?? null,
    createdByAdminId: row.createdByAdminId || null,
    mitigatedAt: row.mitigatedAt ? new Date(row.mitigatedAt).toISOString() : null,
    mitigationNote: row.mitigationNote || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    isMl: false,
    isSupportHealth: false,
    isCsHealth: false,
  };
}

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

/**
 * Pure deterministic signal evaluation (no invent).
 * @param {object} opportunity
 * @param {{ hasPrimary?: boolean, productCount?: number, overdueTaskCount?: number, now?: Date }} ctx
 */
export function computeOpportunityRiskSignals(opportunity, ctx = {}) {
  const now = ctx.now || new Date();
  const signals = [];
  if (!opportunity) return signals;

  const hasPrimary =
    ctx.hasPrimary != null
      ? Boolean(ctx.hasPrimary)
      : Boolean(opportunity.contactId);
  if (!hasPrimary) {
    signals.push({
      code: CRM_OPPORTUNITY_RISK_CODE.MISSING_PRIMARY_CONTACT,
      severity: CRM_OPPORTUNITY_RISK_SEVERITY.CRITICAL,
      detail: 'No PRIMARY contact role / contactId on Opportunity',
    });
  }

  if (opportunity.amount == null || !opportunity.currency || !opportunity.amountBasis) {
    signals.push({
      code: CRM_OPPORTUNITY_RISK_CODE.MISSING_COMMERCIAL,
      severity: CRM_OPPORTUNITY_RISK_SEVERITY.WARN,
      detail: 'Commercial estimate incomplete (amount + currency + amountBasis required)',
    });
  }

  const productCount = Number(ctx.productCount ?? 0);
  if (productCount < 1) {
    signals.push({
      code: CRM_OPPORTUNITY_RISK_CODE.MISSING_PRODUCTS,
      severity: CRM_OPPORTUNITY_RISK_SEVERITY.INFO,
      detail: 'No product estimate lines',
    });
  }

  if (!opportunity.ownerAdminId) {
    signals.push({
      code: CRM_OPPORTUNITY_RISK_CODE.MISSING_OWNER,
      severity: CRM_OPPORTUNITY_RISK_SEVERITY.WARN,
      detail: 'Opportunity has no ownerAdminId',
    });
  }

  if (
    opportunity.closeDateConfidence &&
    String(opportunity.closeDateConfidence).toUpperCase() === 'UNKNOWN'
  ) {
    signals.push({
      code: CRM_OPPORTUNITY_RISK_CODE.CLOSE_DATE_UNKNOWN,
      severity: CRM_OPPORTUNITY_RISK_SEVERITY.WARN,
      detail: 'Expected close confidence is UNKNOWN (not forecast-eligible)',
    });
  }

  if (opportunity.expectedCloseDate) {
    const close = new Date(opportunity.expectedCloseDate);
    if (!Number.isNaN(close.getTime()) && close.getTime() < now.getTime()) {
      const status = String(opportunity.status || '').toUpperCase();
      if (status === 'OPEN') {
        signals.push({
          code: CRM_OPPORTUNITY_RISK_CODE.STALE_EXPECTED_CLOSE,
          severity: CRM_OPPORTUNITY_RISK_SEVERITY.WARN,
          detail: 'Expected close date is in the past while Opportunity is OPEN',
        });
      }
    }
  }

  const overdue = Number(ctx.overdueTaskCount ?? 0);
  if (overdue > 0) {
    signals.push({
      code: CRM_OPPORTUNITY_RISK_CODE.OPEN_OVERDUE_TASKS,
      severity: CRM_OPPORTUNITY_RISK_SEVERITY.WARN,
      detail: `${overdue} open overdue Opportunity task(s)`,
    });
  }

  return signals.map((s) => ({
    ...s,
    signalSource: 'DETERMINISTIC',
    isMl: false,
  }));
}

/**
 * Evaluate + optionally persist OPEN risk rows (upsert by code).
 */
export async function evaluateOpportunityRisks(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_view_forbidden' };
  }

  const row = await loadOpportunity(prisma, args.opportunityId);
  if (!row) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied' };
  }

  let hasPrimary = Boolean(row.contactId);
  if (hasCrmOpportunityContactRoleModel(prisma)) {
    hasPrimary = await hasPrimaryContactRole(prisma, row.id);
  }

  let productCount = 0;
  if (hasCrmOpportunityProductModel(prisma)) {
    try {
      productCount = await prisma.crmOpportunityProduct.count({
        where: { opportunityId: row.id },
      });
    } catch {
      productCount = 0;
    }
  }

  let overdueTaskCount = 0;
  const now = args.now || new Date();
  if (hasCrmTaskModel(prisma)) {
    try {
      const openTasks = await prisma.crmTask.findMany({
        where: {
          subjectType: CRM_SUBJECT_TYPE.OPPORTUNITY,
          subjectId: row.id,
          status: CRM_TASK_STATUS.TODO,
        },
      });
      overdueTaskCount = (openTasks || []).filter(
        (t) => t.dueAt && new Date(t.dueAt).getTime() < now.getTime()
      ).length;
    } catch {
      overdueTaskCount = 0;
    }
  }

  const signals = computeOpportunityRiskSignals(row, {
    hasPrimary,
    productCount,
    overdueTaskCount,
    now,
  });

  const persist = args.persist !== false;
  const persisted = [];
  if (persist && hasCrmOpportunityRiskModel(prisma)) {
    for (const signal of signals) {
      try {
        const existing = await prisma.crmOpportunityRisk.findUnique({
          where: {
            opportunityId_code: { opportunityId: row.id, code: signal.code },
          },
        });
        if (existing && existing.status !== CRM_OPPORTUNITY_RISK_STATUS.OPEN) {
          persisted.push(serializeRisk(existing));
          continue;
        }
        if (existing) {
          const updated = await prisma.crmOpportunityRisk.update({
            where: { id: existing.id },
            data: {
              severity: signal.severity,
              detail: signal.detail,
              signalSource: 'DETERMINISTIC',
              updatedAt: now,
            },
          });
          persisted.push(serializeRisk(updated));
        } else {
          const created = await prisma.crmOpportunityRisk.create({
            data: {
              opportunityId: row.id,
              code: signal.code,
              severity: signal.severity,
              status: CRM_OPPORTUNITY_RISK_STATUS.OPEN,
              detail: signal.detail,
              signalSource: 'DETERMINISTIC',
              createdByAdminId: args.admin?.id || null,
              createdAt: now,
              updatedAt: now,
            },
          });
          persisted.push(serializeRisk(created));
        }
      } catch {
        // model partial / EPERM — keep signal-only
      }
    }
  }

  return {
    ok: true,
    opportunity: serializeOpportunity(row),
    signals,
    risks: persisted.length ? persisted : signals.map((s) => ({
      id: null,
      opportunityId: row.id,
      ...s,
      status: CRM_OPPORTUNITY_RISK_STATUS.OPEN,
      createdByAdminId: null,
      mitigatedAt: null,
      mitigationNote: null,
      createdAt: null,
      updatedAt: null,
      isSupportHealth: false,
      isCsHealth: false,
    })),
    meta: {
      deterministic: true,
      inventForbidden: true,
      isMl: false,
      persisted: Boolean(persist && hasCrmOpportunityRiskModel(prisma)),
    },
  };
}

export async function listOpportunityRisks(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_view_forbidden', items: [] };
  }

  const row = await loadOpportunity(prisma, args.opportunityId);
  if (!row) return { ok: false, notFound: true, error: 'opportunity_not_found', items: [] };

  if (!hasCrmOpportunityRiskModel(prisma)) {
    const evaluated = await evaluateOpportunityRisks(prisma, {
      admin: args.admin,
      opportunityId: row.id,
      persist: false,
    });
    return {
      ok: true,
      items: evaluated.risks || [],
      meta: { unavailable: true, reason: 'crm_opportunity_risk_model_unavailable' },
    };
  }

  let rows = [];
  try {
    rows = await prisma.crmOpportunityRisk.findMany({
      where: { opportunityId: row.id },
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    rows = [];
  }

  return {
    ok: true,
    items: (rows || []).map(serializeRisk),
    meta: { count: (rows || []).length },
  };
}

export { serializeRisk };
