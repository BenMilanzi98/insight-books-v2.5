/**
 * Opportunity numbering — OPP-YYYY-###### (UTC year).
 * Reuses CrmNumberSeq CAS via allocateCrmNumber.
 */

import { allocateCrmNumber, formatCrmNumber, utcYearOf } from '../numbering.js';
import { CRM_NUMBER_PREFIX, CRM_OPPORTUNITY_NUMBER_RE } from '../catalogue.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ now?: Date }} [opts]
 */
export async function allocateOpportunityNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.OPP,
    now: opts.now,
  });
}

export { formatCrmNumber, utcYearOf, CRM_OPPORTUNITY_NUMBER_RE, CRM_NUMBER_PREFIX };
