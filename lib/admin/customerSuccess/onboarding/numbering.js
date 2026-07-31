/**
 * Onboarding numbering — ONR / ONB-YYYY-###### (UTC year).
 * Reuses CrmNumberSeq CAS via allocateCrmNumber.
 */

import { allocateCrmNumber, formatCrmNumber, utcYearOf } from '../../crm/numbering.js';
import {
  CRM_NUMBER_PREFIX,
  ONBOARDING_REQUEST_NUMBER_RE,
  ONBOARDING_PROJECT_NUMBER_RE,
} from './catalogue.js';

export async function allocateOnboardingRequestNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.ONR,
    now: opts.now,
  });
}

export async function allocateOnboardingProjectNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.ONB,
    now: opts.now,
  });
}

export {
  formatCrmNumber,
  utcYearOf,
  ONBOARDING_REQUEST_NUMBER_RE,
  ONBOARDING_PROJECT_NUMBER_RE,
  CRM_NUMBER_PREFIX,
};
