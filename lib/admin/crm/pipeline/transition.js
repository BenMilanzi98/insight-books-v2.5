/**
 * Opportunity stage transition service — Phase 12 Wave 1.
 * Server-governed only; drag clients must call this API.
 * Invalid → INVALID_TRANSITION (never silent coerce).
 * Scope: Wave 1 `all` stub (document).
 */

import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import {
  hasCrmOpportunityContactRoleModel,
  hasPrimaryContactRole,
} from '../opportunities/contacts.js';
import {
  hasCrmOpportunityModel,
  hasCrmOpportunityStageHistoryModel,
  serializeOpportunity,
} from '../opportunities/model.js';
import { applyStageDefaultProbability } from '../opportunities/probability.js';
import { canTransitionStage, isTerminalStage } from './definitions.js';
import { getStageDefinition } from './stages.js';
import {
  CRM_OPPORTUNITY_STATUS,
  CRM_PIPELINE_STAGE,
  CRM_PIPELINE_TERMINAL_STAGES,
} from './catalogue.js';

export {
  hasCrmOpportunityModel,
  hasCrmOpportunityStageHistoryModel,
  serializeOpportunity,
};

function opportunityStatusForStage(stageCode) {
  const code = String(stageCode || '').toUpperCase();
  if (code === CRM_PIPELINE_STAGE.CLOSED_WON) return CRM_OPPORTUNITY_STATUS.WON;
  if (code === CRM_PIPELINE_STAGE.CLOSED_LOST) return CRM_OPPORTUNITY_STATUS.LOST;
  return CRM_OPPORTUNITY_STATUS.OPEN;
}

/**
 * @param {object} args
 * @param {import('@prisma/client').PrismaClient} args.prisma
 * @param {object} args.admin
 * @param {string} args.opportunityId
 * @param {string} args.toStageCode
 * @param {string} [args.reason]
 * @param {unknown} [args.evidenceReferences]
 * @param {string} [args.idempotencyKey]
 * @param {number} [args.expectedVersion] — optimistic lock
 * @param {Date} [args.now]
 */
export async function transitionOpportunityStage(args = {}) {
  const {
    prisma,
    admin,
    opportunityId,
    toStageCode,
    reason,
    evidenceReferences,
    idempotencyKey,
    expectedVersion,
    now: nowArg,
  } = args;

  const access = resolveCrmAccess(admin);
  if (!access.canTransitionOpportunityStages) {
    return { ok: false, forbidden: true, reason: 'crm_pipeline_transition_forbidden' };
  }

  if (!hasCrmOpportunityModel(prisma)) {
    return {
      ok: false,
      error: 'crm_opportunity_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const id = opportunityId ? String(opportunityId).trim() : '';
  if (!id) return { ok: false, error: 'opportunityId_required' };

  const to = String(toStageCode || '').trim().toUpperCase();
  if (!to) return { ok: false, error: 'toStageCode_required' };

  /** Wave 1 scope stub — holders with transition see all */
  const scope = await resolveCrmScope(prisma, admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied', scopeMode: scope.mode };
  }

  let row = null;
  try {
    if (/^OPP-\d{4}-\d{6}$/.test(id)) {
      row = await prisma.crmOpportunity.findUnique({ where: { opportunityNumber: id } });
    } else {
      row = await prisma.crmOpportunity.findUnique({ where: { id } });
    }
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  const key = idempotencyKey != null ? String(idempotencyKey).trim() : '';
  if (key && hasCrmOpportunityStageHistoryModel(prisma)) {
    try {
      const prior = await prisma.crmOpportunityStageHistory.findFirst({
        where: { opportunityId: row.id, idempotencyKey: key },
      });
      if (prior) {
        const priorTo = String(prior.toStageCode || '').toUpperCase();
        if (priorTo !== to) {
          return {
            ok: false,
            error: 'IDEMPOTENCY_KEY_CONFLICT',
            fromStageCode: prior.fromStageCode || null,
            toStageCode: to,
            priorToStageCode: priorTo,
            reason: 'idempotency_key_reuse_different_stage',
            historyId: prior.id,
            scopeMode: scope.mode,
            scopeStub: scope.stub === true,
          };
        }
        const fresh = await prisma.crmOpportunity.findUnique({ where: { id: row.id } });
        return {
          ok: true,
          idempotent: true,
          opportunity: serializeOpportunity(fresh || row),
          historyId: prior.id,
          fromStageCode: prior.fromStageCode || null,
          toStageCode: priorTo,
          scopeMode: scope.mode,
          scopeStub: scope.stub === true,
        };
      }
    } catch {
      // continue
    }
  }

  const from = String(row.stageCode || '').toUpperCase();
  if (!canTransitionStage(from, to)) {
    return {
      ok: false,
      error: 'INVALID_TRANSITION',
      fromStageCode: from,
      toStageCode: to,
      reason: isTerminalStage(from)
        ? 'terminal_stage'
        : from === to
          ? 'same_stage'
          : 'not_sequential_or_terminal',
    };
  }

  // Wave 3: terminal CLOSED_* must go through close.js (evidence / loss reason).
  if (isTerminalStage(to) && args.closeServiceAuthorized !== true) {
    const missingCriteria =
      to === CRM_PIPELINE_STAGE.CLOSED_WON
        ? ['evidence', 'winReason', 'decisionDate', 'use_close_service']
        : ['lossReason', 'use_close_service'];
    return {
      ok: false,
      error: 'USE_CLOSE_SERVICE',
      fromStageCode: from,
      toStageCode: to,
      reason: 'terminal_close_requires_close_service',
      missingCriteria,
    };
  }

  // Wave 2: stages with primary_contact entry criterion require PRIMARY role
  const toDef = getStageDefinition(to, { pipelineCode: row.pipelineCode });
  const entry = toDef?.entryCriteria;
  const needsPrimary =
    Array.isArray(entry) && entry.includes('primary_contact');
  if (needsPrimary) {
    let hasPrimary = false;
    if (hasCrmOpportunityContactRoleModel(prisma)) {
      hasPrimary = await hasPrimaryContactRole(prisma, row.id);
    } else {
      // EPERM / pre-Wave-2 client: handoff contactId satisfies until role table exists
      hasPrimary = Boolean(row.contactId);
    }
    if (!hasPrimary) {
      return {
        ok: false,
        error: 'PRIMARY_CONTACT_REQUIRED',
        fromStageCode: from,
        toStageCode: to,
        reason: 'primary_contact_entry_criterion',
      };
    }
  }

  if (expectedVersion != null && Number(row.version) !== Number(expectedVersion)) {
    return {
      ok: false,
      error: 'OPTIMISTIC_LOCK_CONFLICT',
      expectedVersion: Number(expectedVersion),
      actualVersion: row.version ?? 1,
    };
  }

  const now = nowArg || new Date();
  const nextVersion = (row.version ?? 1) + 1;
  const status = opportunityStatusForStage(to);

  let updated = null;
  if (typeof prisma.crmOpportunity.updateMany === 'function') {
    const lockWhere = { id: row.id };
    if (row.version != null) lockWhere.version = row.version;
    const res = await prisma.crmOpportunity.updateMany({
      where: lockWhere,
      data: {
        stageCode: to,
        status,
        version: nextVersion,
        updatedAt: now,
      },
    });
    if (res.count !== 1) {
      return {
        ok: false,
        error: 'OPTIMISTIC_LOCK_CONFLICT',
        expectedVersion: row.version ?? 1,
      };
    }
    updated = await prisma.crmOpportunity.findUnique({ where: { id: row.id } });
  } else {
    updated = await prisma.crmOpportunity.update({
      where: { id: row.id },
      data: {
        stageCode: to,
        status,
        version: nextVersion,
        updatedAt: now,
      },
    });
  }

  let historyId = null;
  if (hasCrmOpportunityStageHistoryModel(prisma)) {
    const hist = await prisma.crmOpportunityStageHistory.create({
      data: {
        opportunityId: row.id,
        fromStageCode: from,
        toStageCode: to,
        changedByAdminId: admin?.id || null,
        reason: reason != null ? String(reason) : null,
        evidenceReferences:
          evidenceReferences != null ? evidenceReferences : undefined,
        idempotencyKey: key || null,
        at: now,
      },
    });
    historyId = hist?.id || null;
  }

  // Wave 2: apply stage default probability unless MANUAL_OVERRIDE
  let probabilityApplied = false;
  try {
    const probabilityResult = await applyStageDefaultProbability(prisma, {
      opportunity: updated,
      stageCode: to,
      admin,
      now,
      reason: `stage_transition:${from}->${to}`,
    });
    probabilityApplied = Boolean(probabilityResult?.ok && !probabilityResult.skipped);
    const fresh = await prisma.crmOpportunity.findUnique({ where: { id: row.id } });
    if (fresh) updated = fresh;
  } catch {
    probabilityApplied = false;
  }

  return {
    ok: true,
    idempotent: false,
    opportunity: serializeOpportunity(updated),
    historyId,
    fromStageCode: from,
    toStageCode: to,
    scopeMode: scope.mode,
    scopeStub: scope.stub === true,
    /** Drag-and-drop must not persist client-side */
    clientStagePersistForbidden: true,
    probabilityApplied,
  };
}

export { opportunityStatusForStage, CRM_PIPELINE_TERMINAL_STAGES };
