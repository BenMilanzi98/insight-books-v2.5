/**
 * Demo numbering — DMR / DEMO / DENV-YYYY-###### (UTC year).
 * Reuses CrmNumberSeq CAS via allocateCrmNumber.
 */

import { allocateCrmNumber, formatCrmNumber, utcYearOf } from '../numbering.js';
import {
  CRM_DEMO_ENVIRONMENT_NUMBER_RE,
  CRM_DEMO_NUMBER_RE,
  CRM_DEMO_REQUEST_NUMBER_RE,
  CRM_NUMBER_PREFIX,
} from '../catalogue.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ now?: Date }} [opts]
 */
export async function allocateDemoRequestNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.DMR,
    now: opts.now,
  });
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ now?: Date }} [opts]
 */
export async function allocateDemoNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.DEMO,
    now: opts.now,
  });
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ now?: Date }} [opts]
 */
export async function allocateDemoEnvironmentNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.DENV,
    now: opts.now,
  });
}

export {
  formatCrmNumber,
  utcYearOf,
  CRM_DEMO_NUMBER_RE,
  CRM_DEMO_REQUEST_NUMBER_RE,
  CRM_DEMO_ENVIRONMENT_NUMBER_RE,
  CRM_NUMBER_PREFIX,
};
