/**
 * Create Opportunity from Phase 11 READY handoff — Phase 12 Wave 1.
 * Never invents amounts/probability/close dates.
 * Never creates Tenant / Subscription / Invoice.
 */

import { CRM_LEAD_STATUS, CRM_READINESS_STATUS, CRM_NUMBER_PREFIX } from '../catalogue.js';
import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import { allocateCrmNumber } from '../numbering.js';
import {
  CRM_HANDOFF_TYPE_OPPORTUNITY,
  CRM_OPPORTUNITY_STATUS,
  CRM_PIPELINE_CODE,
  CRM_PIPELINE_DEFINITION_VERSION,
  CRM_PIPELINE_STAGE,
} from '../pipeline/catalogue.js';
import {
  hasCrmOpportunityModel,
  hasCrmOpportunityStageHistoryModel,
  serializeOpportunity,
} from './model.js';
import { seedPrimaryContactFromOpportunity } from './contacts.js';
import { applyStageDefaultProbability } from './probability.js';
import { convertLeadAfterOpportunityCreate } from './leads.js';

/**
 * Roll back a newly created Opportunity when Lead conversion fails (fail-closed).
 * Prefer transaction when available; otherwise delete history + opportunity.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} opportunityId
 */
async function compensateFailedLeadConversion(prisma, opportunityId) {
  const id = opportunityId ? String(opportunityId).trim() : '';
  if (!id) return { compensated: false };

  try {
    if (typeof prisma.crmOpportunityStageHistory?.deleteMany === 'function') {
      await prisma.crmOpportunityStageHistory.deleteMany({
        where: { opportunityId: id },
      });
    }
  } catch {
    // best-effort
  }

  try {
    if (typeof prisma.crmOpportunity?.delete === 'function') {
      await prisma.crmOpportunity.delete({ where: { id } });
      return { compensated: true };
    }
  } catch {
    // best-effort
  }

  return { compensated: false };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   handoffPayload: object,
 *   title?: string|null,
 *   now?: Date,
 * }} args
 */
export async function createOpportunityFromHandoff(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canCreateOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_create_forbidden' };
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

  const payload = args.handoffPayload && typeof args.handoffPayload === 'object'
    ? args.handoffPayload
    : null;
  if (!payload) {
    return { ok: false, error: 'handoffPayload_required' };
  }

  const type = String(payload.type || '').trim();
  if (type !== CRM_HANDOFF_TYPE_OPPORTUNITY) {
    return {
      ok: false,
      error: 'invalid_handoff_type',
      expected: CRM_HANDOFF_TYPE_OPPORTUNITY,
      received: type || null,
    };
  }

  const readiness = String(payload.readinessStatus || '').trim().toUpperCase();
  if (readiness !== CRM_READINESS_STATUS.READY) {
    return {
      ok: false,
      error: 'handoff_not_ready',
      readinessStatus: readiness || null,
      detail: 'Opportunity create requires readinessStatus READY',
    };
  }

  const leadId = payload.leadId ? String(payload.leadId).trim() : '';
  if (!leadId) return { ok: false, error: 'handoff_leadId_required' };

  const idempotencyKey = payload.idempotencyKey
    ? String(payload.idempotencyKey).trim()
    : '';
  if (!idempotencyKey) {
    return { ok: false, error: 'handoff_idempotencyKey_required' };
  }

  try {
    const existing = await prisma.crmOpportunity.findUnique({
      where: { handoffIdempotencyKey: idempotencyKey },
    });
    if (existing) {
      return {
        ok: true,
        created: false,
        idempotent: true,
        opportunity: serializeOpportunity(existing),
        subscriptionCreated: false,
        invoiceCreated: false,
        tenantCreated: false,
      };
    }
  } catch {
    // unique lookup optional when model partial
  }

  let lead = null;
  if (typeof prisma.crmLead?.findUnique === 'function') {
    try {
      lead = await prisma.crmLead.findUnique({ where: { id: leadId } });
    } catch {
      lead = null;
    }
  }
  if (!lead) {
    return { ok: false, notFound: true, error: 'lead_not_found' };
  }

  const convertible = new Set([
    CRM_LEAD_STATUS.OPPORTUNITY_READY,
    CRM_LEAD_STATUS.QUALIFIED,
  ]);
  if (lead.status === CRM_LEAD_STATUS.CONVERTED_TO_OPPORTUNITY) {
    // Lead already converted — try find by leadId
    try {
      const byLead = await prisma.crmOpportunity.findFirst({
        where: { leadId: lead.id },
      });
      if (byLead) {
        return {
          ok: true,
          created: false,
          idempotent: true,
          opportunity: serializeOpportunity(byLead),
          subscriptionCreated: false,
          invoiceCreated: false,
          tenantCreated: false,
        };
      }
    } catch {
      // continue to reject
    }
  }
  if (!convertible.has(lead.status)) {
    return {
      ok: false,
      error: 'lead_not_convertible',
      leadStatus: lead.status,
      detail: 'Lead must be OPPORTUNITY_READY or QUALIFIED',
    };
  }

  const now = args.now || new Date();
  const allocated = await allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.OPP,
    now,
  });
  if (!allocated.ok) {
    return { ok: false, error: allocated.error || 'crm_number_allocation_failed' };
  }

  const title =
    (args.title != null && String(args.title).trim()) ||
    lead.title ||
    `Opportunity from ${lead.leadNumber || leadId}`;

  const accountId = payload.accountId || lead.accountId || null;
  const contactId = payload.contactId || lead.contactId || null;

  let row;
  try {
    row = await prisma.crmOpportunity.create({
      data: {
        opportunityNumber: allocated.number,
        pipelineCode: CRM_PIPELINE_CODE.NEW_BUSINESS,
        pipelineVersionId: CRM_PIPELINE_DEFINITION_VERSION,
        stageCode: CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED,
        status: CRM_OPPORTUNITY_STATUS.OPEN,
        leadId: lead.id,
        accountId,
        contactId,
        title,
        ownerAdminId: lead.ownerAdminId || args.admin?.id || null,
        handoffIdempotencyKey: idempotencyKey,
        createdByAdminId: args.admin?.id || null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    if (err && typeof err === 'object' && err.code === 'P2002') {
      try {
        const raced = await prisma.crmOpportunity.findUnique({
          where: { handoffIdempotencyKey: idempotencyKey },
        });
        if (raced) {
          return {
            ok: true,
            created: false,
            idempotent: true,
            opportunity: serializeOpportunity(raced),
            subscriptionCreated: false,
            invoiceCreated: false,
            tenantCreated: false,
          };
        }
      } catch {
        // fall through
      }
    }
    throw err;
  }

  if (hasCrmOpportunityStageHistoryModel(prisma)) {
    await prisma.crmOpportunityStageHistory.create({
      data: {
        opportunityId: row.id,
        fromStageCode: null,
        toStageCode: CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED,
        changedByAdminId: args.admin?.id || null,
        reason: 'opportunity_create_from_ready_handoff',
        idempotencyKey: `create:${idempotencyKey}`,
        at: now,
      },
    });
  }

  // Wave 2: seed PRIMARY from handoff contactId when role model available (non-fatal)
  try {
    await seedPrimaryContactFromOpportunity(prisma, {
      opportunity: row,
      admin: args.admin,
      now,
    });
  } catch {
    // best-effort
  }

  // Wave 2: apply stage default probability (explainable; not invented commercial amount)
  try {
    const prob = await applyStageDefaultProbability(prisma, {
      opportunity: row,
      stageCode: CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED,
      admin: args.admin,
      now,
      reason: 'opportunity_create_stage_default',
    });
    if (prob?.ok && !prob.skipped) {
      const fresh = await prisma.crmOpportunity.findUnique({ where: { id: row.id } });
      if (fresh) row = fresh;
    }
  } catch {
    // best-effort — Wave 1 honesty flags still report probabilityInvented: false
  }

  let convert;
  try {
    convert = await convertLeadAfterOpportunityCreate(prisma, {
      admin: args.admin,
      leadId: lead.id,
      opportunityId: row.id,
      opportunityNumber: row.opportunityNumber,
      now,
    });
  } catch (err) {
    convert = {
      ok: false,
      error: 'lead_conversion_exception',
      code: 'LEAD_CONVERSION_FAILED',
      detail: err?.message || 'Lead conversion threw',
    };
  }

  if (!convert.ok) {
    const compensation = await compensateFailedLeadConversion(prisma, row.id);
    return {
      ok: false,
      error: 'lead_conversion_failed',
      code: 'LEAD_CONVERSION_FAILED',
      detail:
        'Opportunity create rolled back because Lead could not be converted to CONVERTED_TO_OPPORTUNITY',
      leadConversion: convert,
      compensated: compensation.compensated === true,
      opportunityId: row.id,
      opportunityNumber: row.opportunityNumber,
      subscriptionCreated: false,
      invoiceCreated: false,
      tenantCreated: false,
      amountInvented: false,
      probabilityInvented: false,
      closeDateInvented: false,
      scopeMode: scope.mode,
      scopeStub: scope.stub === true,
    };
  }

  return {
    ok: true,
    created: true,
    idempotent: false,
    opportunity: serializeOpportunity(row),
    leadConversion: convert,
    subscriptionCreated: false,
    invoiceCreated: false,
    tenantCreated: false,
    amountInvented: false,
    probabilityInvented: false,
    closeDateInvented: false,
    scopeMode: scope.mode,
    scopeStub: scope.stub === true,
  };
}
