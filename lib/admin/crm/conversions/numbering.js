/**
 * Conversion numbering — CVR / CVN-YYYY-###### (UTC year).
 * Reuses CrmNumberSeq CAS via allocateCrmNumber.
 */

import { allocateCrmNumber, formatCrmNumber, utcYearOf } from '../numbering.js';
import {
  CRM_CONVERSION_NUMBER_RE,
  CRM_CONVERSION_REQUEST_NUMBER_RE,
  CRM_NUMBER_PREFIX,
} from '../catalogue.js';

export async function allocateConversionRequestNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.CVR,
    now: opts.now,
  });
}

export async function allocateConversionNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.CVN,
    now: opts.now,
  });
}

export {
  formatCrmNumber,
  utcYearOf,
  CRM_CONVERSION_REQUEST_NUMBER_RE,
  CRM_CONVERSION_NUMBER_RE,
  CRM_NUMBER_PREFIX,
};
