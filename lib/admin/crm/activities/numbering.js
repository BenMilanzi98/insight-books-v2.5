/**
 * Activity numbering — ACT-YYYY-###### (UTC year).
 * Task child may use TASK-YYYY-###### via allocateTaskNumber.
 */

import { allocateCrmNumber, formatCrmNumber, utcYearOf } from '../numbering.js';
import {
  CRM_NUMBER_PREFIX,
  CRM_ACTIVITY_NUMBER_RE,
  CRM_TASK_NUMBER_RE,
} from '../catalogue.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ now?: Date }} [opts]
 */
export async function allocateActivityNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.ACT,
    now: opts.now,
  });
}

/**
 * Optional Task child number — TASK-YYYY-######.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ now?: Date }} [opts]
 */
export async function allocateTaskNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.TASK,
    now: opts.now,
  });
}

export {
  formatCrmNumber,
  utcYearOf,
  CRM_ACTIVITY_NUMBER_RE,
  CRM_TASK_NUMBER_RE,
  CRM_NUMBER_PREFIX,
};
