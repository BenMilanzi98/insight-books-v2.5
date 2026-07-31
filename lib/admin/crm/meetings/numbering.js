/**
 * Meeting numbering — MEET-YYYY-###### (UTC year).
 */

import { allocateCrmNumber } from '../numbering.js';
import { CRM_NUMBER_PREFIX, CRM_MEETING_NUMBER_RE } from '../catalogue.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ now?: Date }} [opts]
 */
export async function allocateMeetingNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.MEET,
    now: opts.now,
  });
}

export { CRM_MEETING_NUMBER_RE, CRM_NUMBER_PREFIX };
