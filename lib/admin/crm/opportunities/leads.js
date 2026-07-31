/**

 * Lead → CONVERTED_TO_OPPORTUNITY — only from Opportunity create success path.

 * Module-private: import from create.js only (not re-exported from CRM public index).

 * Requires a persisted Opportunity linked to the Lead before converting.

 */



import { CRM_LEAD_STATUS } from '../catalogue.js';

import { resolveCrmAccess } from '../authz.js';

import { assertTransition } from '../stateMachine.js';

import { hasCrmLeadModel, serializeLead } from '../leads.js';

import { hasCrmOpportunityModel } from './model.js';



/**

 * Convert Lead after successful Opportunity create.

 * Verifies Opportunity exists and `opportunity.leadId === leadId` before gating.

 * AuthZ: transitionStatus/editLeads OR opportunities.create (elevated on create path).

 *

 * @param {import('@prisma/client').PrismaClient} prisma

 * @param {{

 *   admin: object,

 *   leadId: string,

 *   opportunityId: string,

 *   opportunityNumber?: string,

 *   now?: Date,

 * }} args

 */

export async function convertLeadAfterOpportunityCreate(prisma, args = {}) {

  const leadId = args.leadId ? String(args.leadId).trim() : '';

  if (!leadId) return { ok: false, error: 'leadId_required' };



  const opportunityId = args.opportunityId ? String(args.opportunityId).trim() : '';

  if (!opportunityId) {

    return {

      ok: false,

      error: 'opportunityId_required',

      code: 'OPPORTUNITY_REQUIRED',

      detail: 'Lead convert requires a persisted Opportunity id',

    };

  }



  const access = resolveCrmAccess(args.admin);

  if (!access.canTransitionStatus && !access.canCreateOpportunities) {

    return { ok: false, forbidden: true, reason: 'crm_transition_forbidden' };

  }



  if (!hasCrmOpportunityModel(prisma)) {

    return {

      ok: false,

      error: 'crm_opportunity_model_unavailable',

      status: 'UNAVAILABLE',

      code: 'OPPORTUNITY_REQUIRED',

    };

  }



  let opportunity = null;

  try {

    opportunity = await prisma.crmOpportunity.findUnique({

      where: { id: opportunityId },

    });

  } catch {

    opportunity = null;

  }

  if (!opportunity) {

    return {

      ok: false,

      error: 'opportunity_not_found',

      code: 'OPPORTUNITY_REQUIRED',

      detail: 'Cannot convert Lead without a persisted Opportunity',

    };

  }

  if (String(opportunity.leadId || '') !== leadId) {

    return {

      ok: false,

      error: 'opportunity_lead_mismatch',

      code: 'OPPORTUNITY_LEAD_MISMATCH',

      opportunityId,

      leadId,

      opportunityLeadId: opportunity.leadId || null,

    };

  }



  if (!hasCrmLeadModel(prisma)) {

    return { ok: false, error: 'crm_lead_model_unavailable', status: 'UNAVAILABLE' };

  }



  let lead = null;

  try {

    lead = await prisma.crmLead.findUnique({ where: { id: leadId } });

  } catch {

    lead = null;

  }

  if (!lead) return { ok: false, notFound: true, error: 'lead_not_found' };



  if (lead.status === CRM_LEAD_STATUS.CONVERTED_TO_OPPORTUNITY) {

    return { ok: true, lead: serializeLead(lead), idempotent: true };

  }



  const reason = `opportunity_create:${args.opportunityNumber || opportunityId}`;

  const gate = assertTransition(

    lead.status,

    CRM_LEAD_STATUS.CONVERTED_TO_OPPORTUNITY,

    { fromOpportunityCreate: true, reason }

  );

  if (!gate.ok) return gate;



  const now = args.now || new Date();

  const updated = await prisma.crmLead.update({

    where: { id: lead.id },

    data: {

      status: CRM_LEAD_STATUS.CONVERTED_TO_OPPORTUNITY,

      updatedAt: now,

    },

  });



  if (typeof prisma.crmLeadStatusHistory?.create === 'function') {

    await prisma.crmLeadStatusHistory.create({

      data: {

        leadId: lead.id,

        fromStatus: lead.status,

        toStatus: CRM_LEAD_STATUS.CONVERTED_TO_OPPORTUNITY,

        changedByAdminId: args.admin?.id || null,

        reason,

        at: now,

      },

    });

  }



  return { ok: true, lead: serializeLead(updated) };

}


