/**
 * Adoption numbering — ADR / ADP (UTC year).
 * Reuses CrmNumberSeq CAS via allocateCrmNumber.
 */

import { allocateCrmNumber, formatCrmNumber, utcYearOf } from '../../crm/numbering.js';
import {
  CRM_NUMBER_PREFIX,
  ADOPTION_REQUEST_NUMBER_RE,
  ADOPTION_PLAN_NUMBER_RE,
} from './catalogue.js';

export async function allocateAdoptionRequestNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.ADR,
    now: opts.now,
  });
}

export async function allocateAdoptionPlanNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.ADP,
    now: opts.now,
  });
}

export {
  formatCrmNumber,
  utcYearOf,
  ADOPTION_REQUEST_NUMBER_RE,
  ADOPTION_PLAN_NUMBER_RE,
  CRM_NUMBER_PREFIX,
};
