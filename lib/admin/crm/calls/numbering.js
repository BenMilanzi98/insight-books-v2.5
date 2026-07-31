/**
 * Call numbering — CALL-YYYY-###### (UTC year).
 */

import { allocateCrmNumber } from '../numbering.js';
import { CRM_NUMBER_PREFIX, CRM_CALL_NUMBER_RE } from '../catalogue.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ now?: Date }} [opts]
 */
export async function allocateCallNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.CALL,
    now: opts.now,
  });
}

export { CRM_CALL_NUMBER_RE, CRM_NUMBER_PREFIX };
