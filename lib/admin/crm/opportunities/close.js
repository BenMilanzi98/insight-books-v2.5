/**
 * Opportunity win/loss close — Phase 12 Wave 3 / Phase 20 Wave 1 harden.
 * CLOSED_WON requires evidence + win reason + decision date.
 * CLOSED_LOST requires loss reason.
 * Never provisions Tenant / Subscription / Invoice / Payment.
 * Commercial-backed Closed-Won (acceptanceId or ACCEPTANCE evidence) must pass
 * commercial readiness — not opt-in via acceptanceId alone.
 */

import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import { CRM_TIMELINE_EVENT_TYPE } from '../catalogue.js';
import { evaluateClosedWonReadiness } from '../commercial/readiness.js';
import {
  CRM_OPPORTUNITY_STATUS,
  CRM_PIPELINE_STAGE,
} from '../pipeline/catalogue.js';
import { isTerminalStage } from '../pipeline/definitions.js';
import { transitionOpportunityStage } from '../pipeline/transition.js';
import { hasCrmOpportunityModel, serializeOpportunity } from './model.js';
import { appendOpportunityTimelineEvent } from './timeline.js';

export const CRM_CLOSE_APPROVAL_STATUS = Object.freeze({
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
});

export const CRM_WIN_REASON = Object.freeze({
  BEST_FIT: 'BEST_FIT',
  PRICE: 'PRICE',
  RELATIONSHIP: 'RELATIONSHIP',
  URGENCY: 'URGENCY',
  OTHER: 'OTHER',
});

export const CRM_LOSS_REASON = Object.freeze({
  NO_BUDGET: 'NO_BUDGET',
  COMPETITOR: 'COMPETITOR',
  NO_DECISION: 'NO_DECISION',
  TIMING: 'TIMING',
  REQUIREMENTS_MISMATCH: 'REQUIREMENTS_MISMATCH',
  OTHER: 'OTHER',
});

/**
 * Assert no Tenant / Subscription / Invoice / Payment provision occurred.
 * Always returns ok with provision flags false for Wave 3 close path.
 */
export function assertNoProvision(result = {}) {
  const flags = {
    tenantCreated: result.tenantCreated === true,
    subscriptionCreated: result.subscriptionCreated === true,
    invoiceCreated: result.invoiceCreated === true,
    paymentCreated: result.paymentCreated === true,
    provisionExecuted: result.provisionExecuted === true,
  };
  const provisioned = Object.values(flags).some(Boolean);
  return {
    ok: !provisioned,
    provisioned,
    ...flags,
    assertNoProvision: true,
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

function normalizeEvidence(evidence) {
  if (evidence == null) return null;
  if (Array.isArray(evidence)) {
    return evidence
      .map((e) => {
        if (typeof e === 'string') return { type: 'REFERENCE', value: e };
        if (e && typeof e === 'object') return e;
        return null;
      })
      .filter(Boolean);
  }
  if (typeof evidence === 'string' && evidence.trim()) {
    return [{ type: 'REFERENCE', value: evidence.trim() }];
  }
  if (typeof evidence === 'object') return [evidence];
  return null;
}

function hasEvidence(evidence) {
  const norm = normalizeEvidence(evidence);
  return Array.isArray(norm) && norm.length > 0;
}

/**
 * Resolve acceptance id from explicit arg or commercial ACCEPTANCE evidence.
 * Evidence `{ type: 'ACCEPTANCE', value }` alone must trigger readiness.
 */
export function resolveClosedWonAcceptanceId(args = {}) {
  const explicit = args.acceptanceId ? String(args.acceptanceId).trim() : '';
  if (explicit) return explicit;
  const evidence = normalizeEvidence(args.evidence ?? args.evidenceReferences);
  if (!Array.isArray(evidence)) return '';
  for (const e of evidence) {
    const type = String(e?.type || e?.kind || '')
      .trim()
      .toUpperCase();
    if (type !== 'ACCEPTANCE' && type !== 'COMMERCIAL_ACCEPTANCE') continue;
    const id = String(e.value || e.acceptanceId || e.id || e.ref || '').trim();
    if (id) return id;
  }
  return '';
}

/**
 * Commercial evidence required by policy when:
 * - acceptanceId / ACCEPTANCE evidence is present, or
 * - requireCommercialReadiness === true
 */
export function commercialReadinessRequiredByPolicy(args = {}, acceptanceId = '') {
  if (args.requireCommercialReadiness === true) return true;
  if (args.requireCommercialReadiness === false && !acceptanceId) return false;
  return Boolean(acceptanceId);
}

/**
 * Close as CLOSED_WON — evidence + winReason + decisionDate required.
 */
export async function closeOpportunityWon(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canTransitionOpportunityStages && !access.canEditOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_close_forbidden' };
  }

  const row = await loadOpportunity(prisma, args.opportunityId);
  if (!row) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return {
      ok: false,
      forbidden: true,
      reason: scope.reason || 'crm_scope_denied',
      error: scope.reason || 'crm_scope_denied',
      tenantCreated: false,
      subscriptionCreated: false,
      invoiceCreated: false,
      paymentCreated: false,
      provisionExecuted: false,
    };
  }

  if (isTerminalStage(row.stageCode)) {
    return {
      ok: false,
      error: 'ALREADY_TERMINAL',
      stageCode: row.stageCode,
      reason: 'opportunity_already_closed',
      idempotent: true,
      tenantCreated: false,
      subscriptionCreated: false,
      invoiceCreated: false,
      paymentCreated: false,
      provisionExecuted: false,
    };
  }

  const winReason = args.winReason != null ? String(args.winReason).trim().toUpperCase() : '';
  if (!winReason) {
    return { ok: false, error: 'WIN_REASON_REQUIRED', missingCriteria: ['winReason'] };
  }

  const decisionDate = args.decisionDate ? new Date(args.decisionDate) : null;
  if (!decisionDate || Number.isNaN(decisionDate.getTime())) {
    return { ok: false, error: 'DECISION_DATE_REQUIRED', missingCriteria: ['decisionDate'] };
  }

  if (!hasEvidence(args.evidence ?? args.evidenceReferences)) {
    return {
      ok: false,
      error: 'CLOSED_WON_EVIDENCE_REQUIRED',
      missingCriteria: ['evidence'],
    };
  }

  // Phase 20 — commercial readiness when acceptanceId OR ACCEPTANCE evidence (not opt-in only)
  const acceptanceId = resolveClosedWonAcceptanceId(args);
  if (commercialReadinessRequiredByPolicy(args, acceptanceId)) {
    if (!acceptanceId) {
      return {
        ok: false,
        error: 'CLOSED_WON_ACCEPTANCE_REQUIRED',
        reason: 'commercial_evidence_requires_acceptance',
        readinessStatus: 'UNKNOWN',
        tenantCreated: false,
        subscriptionCreated: false,
        invoiceCreated: false,
        paymentCreated: false,
        provisionExecuted: false,
      };
    }
    const readiness = await evaluateClosedWonReadiness(prisma, {
      acceptanceId,
      admin: args.admin,
      opportunityId: row.id,
      requireDiscountApprovals: args.requireDiscountApprovals,
      now: args.now,
    });
    const status = String(readiness?.readinessStatus || 'UNKNOWN').toUpperCase();
    const ready =
      readiness?.ok !== false &&
      (status === 'READY' || status === 'HANDED_OFF' || status === 'READY_WITH_WARNINGS');
    if (!ready) {
      return {
        ok: false,
        error: 'CLOSED_WON_READINESS_BLOCKED',
        reason: `readiness_${status.toLowerCase()}`,
        readinessStatus: status,
        readiness,
        acceptanceId,
        tenantCreated: false,
        subscriptionCreated: false,
        invoiceCreated: false,
        paymentCreated: false,
        provisionExecuted: false,
      };
    }
  }

  const evidence = normalizeEvidence(args.evidence ?? args.evidenceReferences);
  const now = args.now || new Date();
  const approvalStatus =
    args.requireApproval === true
      ? CRM_CLOSE_APPROVAL_STATUS.PENDING
      : CRM_CLOSE_APPROVAL_STATUS.NOT_REQUIRED;

  if (approvalStatus === CRM_CLOSE_APPROVAL_STATUS.PENDING && args.approvalGranted !== true) {
    // Stub: record pending without stage move when approval required and not granted
    try {
      await prisma.crmOpportunity.update({
        where: { id: row.id },
        data: {
          winReason,
          decisionDate,
          closeEvidence: evidence,
          closeApprovalStatus: approvalStatus,
          updatedAt: now,
        },
      });
    } catch {
      // column may be missing pre-SQL
    }
    return {
      ok: false,
      error: 'CLOSE_APPROVAL_PENDING',
      approvalStatus,
      opportunity: serializeOpportunity({
        ...row,
        winReason,
        decisionDate,
        closeEvidence: evidence,
        closeApprovalStatus: approvalStatus,
      }),
      tenantCreated: false,
      subscriptionCreated: false,
      invoiceCreated: false,
      paymentCreated: false,
      provisionExecuted: false,
    };
  }

  // SoD: Closed-Won approver must differ from requester (owner / requestedBy)
  if (
    approvalStatus === CRM_CLOSE_APPROVAL_STATUS.PENDING &&
    args.approvalGranted === true
  ) {
    const requesterId = String(
      args.requestedByAdminId || row.ownerAdminId || ''
    ).trim();
    const approverId = args.admin?.id ? String(args.admin.id).trim() : '';
    if (requesterId && approverId && requesterId === approverId) {
      return {
        ok: false,
        error: 'CLOSE_SOD_BLOCKED',
        reason: 'sod_requester_must_differ_from_approver',
        tenantCreated: false,
        subscriptionCreated: false,
        invoiceCreated: false,
        paymentCreated: false,
        provisionExecuted: false,
      };
    }
  }

  const transition = await transitionOpportunityStage({
    prisma,
    admin: args.admin,
    opportunityId: row.id,
    toStageCode: CRM_PIPELINE_STAGE.CLOSED_WON,
    reason: args.reason || `closed_won:${winReason}`,
    evidenceReferences: evidence,
    idempotencyKey: args.idempotencyKey,
    expectedVersion: args.expectedVersion,
    now,
    closeServiceAuthorized: true,
  });

  if (!transition.ok) {
    return {
      ...transition,
      tenantCreated: false,
      subscriptionCreated: false,
      invoiceCreated: false,
      paymentCreated: false,
      provisionExecuted: false,
    };
  }

  let updated = transition.opportunity;
  try {
    const fresh = await prisma.crmOpportunity.update({
      where: { id: row.id },
      data: {
        winReason,
        lossReason: null,
        decisionDate,
        closeEvidence: evidence,
        closedAt: now,
        closedByAdminId: args.admin?.id || null,
        closeApprovalStatus: approvalStatus === CRM_CLOSE_APPROVAL_STATUS.PENDING
          ? CRM_CLOSE_APPROVAL_STATUS.APPROVED
          : approvalStatus,
        status: CRM_OPPORTUNITY_STATUS.WON,
        updatedAt: now,
      },
    });
    updated = serializeOpportunity(fresh);
  } catch {
    updated = serializeOpportunity({
      ...(transition.opportunity || row),
      winReason,
      decisionDate,
      closeEvidence: evidence,
      closedAt: now,
      status: CRM_OPPORTUNITY_STATUS.WON,
    });
  }

  await appendOpportunityTimelineEvent(prisma, {
    opportunityId: row.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.CLOSED_WON,
    summary: `Closed won: ${winReason}`,
    payload: {
      winReason,
      decisionDate: decisionDate.toISOString(),
      evidenceCount: evidence.length,
      tenantCreated: false,
      subscriptionCreated: false,
      invoiceCreated: false,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  const result = {
    ok: true,
    opportunity: updated,
    fromStageCode: transition.fromStageCode,
    toStageCode: CRM_PIPELINE_STAGE.CLOSED_WON,
    historyId: transition.historyId,
    idempotent: Boolean(transition.idempotent),
    tenantCreated: false,
    subscriptionCreated: false,
    invoiceCreated: false,
    paymentCreated: false,
    provisionExecuted: false,
  };

  return { ...result, provisionCheck: assertNoProvision(result) };
}

/**
 * Close as CLOSED_LOST — lossReason required.
 */
export async function closeOpportunityLost(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canTransitionOpportunityStages && !access.canEditOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_close_forbidden' };
  }

  const row = await loadOpportunity(prisma, args.opportunityId);
  if (!row) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied' };
  }

  if (isTerminalStage(row.stageCode)) {
    return {
      ok: false,
      error: 'ALREADY_TERMINAL',
      stageCode: row.stageCode,
      reason: 'opportunity_already_closed',
    };
  }

  const lossReason = args.lossReason != null ? String(args.lossReason).trim().toUpperCase() : '';
  if (!lossReason) {
    return { ok: false, error: 'LOSS_REASON_REQUIRED', missingCriteria: ['lossReason'] };
  }

  const decisionDate = args.decisionDate ? new Date(args.decisionDate) : new Date();
  const now = args.now || new Date();
  const evidence = normalizeEvidence(args.evidence ?? args.evidenceReferences);

  const transition = await transitionOpportunityStage({
    prisma,
    admin: args.admin,
    opportunityId: row.id,
    toStageCode: CRM_PIPELINE_STAGE.CLOSED_LOST,
    reason: args.reason || `closed_lost:${lossReason}`,
    evidenceReferences: evidence || undefined,
    idempotencyKey: args.idempotencyKey,
    expectedVersion: args.expectedVersion,
    now,
    closeServiceAuthorized: true,
  });

  if (!transition.ok) {
    return {
      ...transition,
      tenantCreated: false,
      subscriptionCreated: false,
      invoiceCreated: false,
      paymentCreated: false,
      provisionExecuted: false,
    };
  }

  let updated = transition.opportunity;
  try {
    const fresh = await prisma.crmOpportunity.update({
      where: { id: row.id },
      data: {
        lossReason,
        winReason: null,
        decisionDate: Number.isNaN(decisionDate.getTime()) ? now : decisionDate,
        closeEvidence: evidence || undefined,
        closedAt: now,
        closedByAdminId: args.admin?.id || null,
        closeApprovalStatus: CRM_CLOSE_APPROVAL_STATUS.NOT_REQUIRED,
        status: CRM_OPPORTUNITY_STATUS.LOST,
        updatedAt: now,
      },
    });
    updated = serializeOpportunity(fresh);
  } catch {
    updated = serializeOpportunity({
      ...(transition.opportunity || row),
      lossReason,
      closedAt: now,
      status: CRM_OPPORTUNITY_STATUS.LOST,
    });
  }

  await appendOpportunityTimelineEvent(prisma, {
    opportunityId: row.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.CLOSED_LOST,
    summary: `Closed lost: ${lossReason}`,
    payload: { lossReason, tenantCreated: false, subscriptionCreated: false, invoiceCreated: false },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  const result = {
    ok: true,
    opportunity: updated,
    fromStageCode: transition.fromStageCode,
    toStageCode: CRM_PIPELINE_STAGE.CLOSED_LOST,
    historyId: transition.historyId,
    idempotent: Boolean(transition.idempotent),
    tenantCreated: false,
    subscriptionCreated: false,
    invoiceCreated: false,
    paymentCreated: false,
    provisionExecuted: false,
  };

  return { ...result, provisionCheck: assertNoProvision(result) };
}

/**
 * Reopen from terminal stage to CUSTOMER_DECISION (or explicit toStageCode open stage).
 * Requires reason. Does not invent commercial / probability.
 */
export async function reopenOpportunity(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canTransitionOpportunityStages && !access.canEditOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_reopen_forbidden' };
  }

  const row = await loadOpportunity(prisma, args.opportunityId);
  if (!row) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  if (!isTerminalStage(row.stageCode)) {
    return {
      ok: false,
      error: 'NOT_TERMINAL',
      reason: 'reopen_requires_terminal_stage',
      stageCode: row.stageCode,
    };
  }

  const reopenReason = args.reopenReason != null ? String(args.reopenReason).trim() : '';
  if (!reopenReason) {
    return { ok: false, error: 'REOPEN_REASON_REQUIRED', missingCriteria: ['reopenReason'] };
  }

  const toStage =
    args.toStageCode != null
      ? String(args.toStageCode).trim().toUpperCase()
      : CRM_PIPELINE_STAGE.CUSTOMER_DECISION;

  if (isTerminalStage(toStage)) {
    return { ok: false, error: 'INVALID_REOPEN_TARGET', toStageCode: toStage };
  }

  const now = args.now || new Date();
  const nextVersion = (row.version ?? 1) + 1;

  let updated = null;
  try {
    updated = await prisma.crmOpportunity.update({
      where: { id: row.id },
      data: {
        stageCode: toStage,
        status: CRM_OPPORTUNITY_STATUS.OPEN,
        version: nextVersion,
        reopenReason,
        reopenedAt: now,
        reopenedByAdminId: args.admin?.id || null,
        closedAt: null,
        updatedAt: now,
      },
    });
  } catch (err) {
    return { ok: false, error: 'reopen_update_failed', detail: String(err?.message || err) };
  }

  if (hasCrmOpportunityModel(prisma) && typeof prisma.crmOpportunityStageHistory?.create === 'function') {
    try {
      await prisma.crmOpportunityStageHistory.create({
        data: {
          opportunityId: row.id,
          fromStageCode: row.stageCode,
          toStageCode: toStage,
          changedByAdminId: args.admin?.id || null,
          reason: `reopen:${reopenReason}`,
          idempotencyKey: args.idempotencyKey || null,
          at: now,
        },
      });
    } catch {
      // history optional on conflict
    }
  }

  await appendOpportunityTimelineEvent(prisma, {
    opportunityId: row.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.REOPENED,
    summary: `Reopened to ${toStage}: ${reopenReason.slice(0, 120)}`,
    payload: {
      fromStageCode: row.stageCode,
      toStageCode: toStage,
      reopenReason,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    opportunity: serializeOpportunity(updated),
    fromStageCode: row.stageCode,
    toStageCode: toStage,
    tenantCreated: false,
    subscriptionCreated: false,
    invoiceCreated: false,
    paymentCreated: false,
    provisionExecuted: false,
    provisionCheck: assertNoProvision({}),
  };
}
