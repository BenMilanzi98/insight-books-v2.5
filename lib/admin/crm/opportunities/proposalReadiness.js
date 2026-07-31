/**
 * Proposal readiness — Phase 12 Wave 3.
 * Checklist + typed handoff payload. NEVER creates Proposal / Quotation.
 */

import { CRM_READINESS_STATUS, CRM_TIMELINE_EVENT_TYPE } from '../catalogue.js';
import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import { CRM_PIPELINE_STAGE, CRM_PIPELINE_STAGES_ORDERED } from '../pipeline/catalogue.js';
import { hasCrmOpportunityContactRoleModel, hasPrimaryContactRole } from './contacts.js';
import { hasCrmOpportunityModel, serializeOpportunity } from './model.js';
import { hasCrmOpportunityProductModel } from './products.js';
import { appendOpportunityTimelineEvent } from './timeline.js';

const PROPOSAL_HANDOFF_TYPE = 'CRM_PROPOSAL_HANDOFF';
const PROPOSAL_HANDOFF_VERSION = 'crm-proposal-readiness-v1-2026-07-30';

const PROPOSAL_ELIGIBLE_STAGES = new Set([
  CRM_PIPELINE_STAGE.PROPOSAL_READY,
  CRM_PIPELINE_STAGE.CUSTOMER_DECISION,
  CRM_PIPELINE_STAGE.CLOSED_WON,
]);

function item(key, ok, severity, detail, blocker = false) {
  return {
    key,
    ok: Boolean(ok),
    severity: severity || (ok ? 'INFO' : 'WARN'),
    detail: detail || null,
    blocker: Boolean(blocker),
  };
}

function deriveStatus(items) {
  const blockers = items.filter((i) => i.blocker && !i.ok);
  if (blockers.length > 0) return CRM_READINESS_STATUS.BLOCKED;
  const failed = items.filter((i) => !i.ok);
  if (failed.length === 0) return CRM_READINESS_STATUS.READY;
  const requiredFailed = failed.filter((i) => i.severity !== 'INFO');
  if (requiredFailed.length === 0) return CRM_READINESS_STATUS.PARTIALLY_READY;
  const allSoft = requiredFailed.every((i) => i.severity === 'WARN');
  if (allSoft && requiredFailed.length < items.length) {
    return CRM_READINESS_STATUS.PARTIALLY_READY;
  }
  return CRM_READINESS_STATUS.NOT_READY;
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
 * Evaluate proposal readiness. Never creates Proposal/Quotation.
 */
export async function evaluateProposalReadiness(prisma, args = {}) {
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

  const items = [];
  const stage = String(row.stageCode || '').toUpperCase();
  const stageIdx = CRM_PIPELINE_STAGES_ORDERED.indexOf(stage);
  const proposalIdx = CRM_PIPELINE_STAGES_ORDERED.indexOf(CRM_PIPELINE_STAGE.PROPOSAL_READY);
  const stageOk = PROPOSAL_ELIGIBLE_STAGES.has(stage) || (stageIdx >= 0 && stageIdx >= proposalIdx - 1);
  items.push(
    item(
      'stage_eligible',
      stageOk,
      stageOk ? 'INFO' : 'CRITICAL',
      stageOk
        ? `Stage ${stage} eligible for proposal readiness`
        : `Stage ${stage} not yet at/near PROPOSAL_READY`,
      !stageOk
    )
  );

  let hasPrimary = Boolean(row.contactId);
  if (hasCrmOpportunityContactRoleModel(prisma)) {
    hasPrimary = await hasPrimaryContactRole(prisma, row.id);
  }
  items.push(
    item(
      'primary_contact',
      hasPrimary,
      hasPrimary ? 'INFO' : 'CRITICAL',
      hasPrimary ? 'PRIMARY contact present' : 'PRIMARY contact required',
      !hasPrimary
    )
  );

  const commercialOk = row.amount != null && Boolean(row.currency) && Boolean(row.amountBasis);
  items.push(
    item(
      'commercial_estimate',
      commercialOk,
      commercialOk ? 'INFO' : 'CRITICAL',
      commercialOk
        ? `Commercial ${row.amount} ${row.currency} (${row.amountBasis})`
        : 'amount + currency + amountBasis required',
      !commercialOk
    )
  );

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
  const productsOk = productCount > 0;
  items.push(
    item(
      'products',
      productsOk,
      productsOk ? 'INFO' : 'WARN',
      productsOk ? `${productCount} product line(s)` : 'No product estimate lines',
      false
    )
  );

  const readinessStatus = deriveStatus(items);
  const idempotencyKey = `proposal-ready:${row.id}:${stage}:${row.version ?? 1}`;

  const handoffPayload = {
    type: PROPOSAL_HANDOFF_TYPE,
    version: PROPOSAL_HANDOFF_VERSION,
    readinessStatus,
    opportunityId: row.id,
    opportunityNumber: row.opportunityNumber,
    leadId: row.leadId || null,
    accountId: row.accountId || null,
    contactId: row.contactId || null,
    stageCode: stage,
    amount: row.amount != null ? String(row.amount) : null,
    currency: row.currency || null,
    amountBasis: row.amountBasis || null,
    idempotencyKey,
    /** Honesty — Phase 12 never creates these */
    proposalId: null,
    proposalCreated: false,
    quotationId: null,
    quotationCreated: false,
    inventProposalForbidden: true,
  };

  const now = args.now || new Date();
  await appendOpportunityTimelineEvent(prisma, {
    opportunityId: row.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.PROPOSAL_READINESS,
    summary: `Proposal readiness: ${readinessStatus}`,
    payload: {
      readinessStatus,
      checklistKeys: items.map((i) => i.key),
      proposalCreated: false,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  /** Phase 15 Wave 1 — optional seed PRQ only (never creates Proposal document). */
  let proposalRequest = null;
  if (args.seedProposalRequest === true) {
    try {
      const { seedProposalRequestFromOpportunityReadiness } = await import(
        '../commercial/requests.js'
      );
      const seeded = await seedProposalRequestFromOpportunityReadiness(prisma, {
        admin: args.admin,
        actorContext: { admin: args.admin },
        opportunityId: row.id,
        accountId: row.accountId,
        contactId: row.contactId,
        leadId: row.leadId,
        currency: row.currency,
        handoffPayload,
        now,
      });
      if (seeded?.ok) proposalRequest = seeded.request;
    } catch {
      proposalRequest = null;
    }
  }

  return {
    ok: true,
    readinessStatus,
    checklist: items,
    handoffPayload,
    proposalRequest,
    proposalCreated: false,
    quotationCreated: false,
    opportunity: serializeOpportunity(row),
    meta: {
      definitionVersion: PROPOSAL_HANDOFF_VERSION,
      inventProposalForbidden: true,
    },
  };
}

export function assertNoProposalCreate(result) {
  return (
    result?.proposalCreated === false &&
    result?.handoffPayload?.proposalId == null &&
    result?.handoffPayload?.proposalCreated === false &&
    result?.handoffPayload?.quotationCreated === false
  );
}

export { PROPOSAL_HANDOFF_TYPE, PROPOSAL_HANDOFF_VERSION };
