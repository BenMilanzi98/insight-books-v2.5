/**
 * Training numbering — TRQ / TRN / COH / TRS / IB-TRN-CERT-YYYY-###### (UTC year).
 * Reuses CrmNumberSeq CAS via allocateCrmNumber.
 */

import { allocateCrmNumber, formatCrmNumber, utcYearOf } from '../../crm/numbering.js';
import {
  CRM_NUMBER_PREFIX,
  TRAINING_REQUEST_NUMBER_RE,
  TRAINING_PROGRAM_NUMBER_RE,
  TRAINING_COHORT_NUMBER_RE,
  TRAINING_SESSION_NUMBER_RE,
  TRAINING_CERTIFICATE_NUMBER_RE,
} from './catalogue.js';

export async function allocateTrainingRequestNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.TRQ,
    now: opts.now,
  });
}

export async function allocateTrainingProgramNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.TRN,
    now: opts.now,
  });
}

export async function allocateTrainingCohortNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.COH,
    now: opts.now,
  });
}

export async function allocateTrainingSessionNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.TRS,
    now: opts.now,
  });
}

export async function allocateTrainingCertificateNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.CERT,
    now: opts.now,
  });
}

export {
  formatCrmNumber,
  utcYearOf,
  TRAINING_REQUEST_NUMBER_RE,
  TRAINING_PROGRAM_NUMBER_RE,
  TRAINING_COHORT_NUMBER_RE,
  TRAINING_SESSION_NUMBER_RE,
  TRAINING_CERTIFICATE_NUMBER_RE,
  CRM_NUMBER_PREFIX,
};
