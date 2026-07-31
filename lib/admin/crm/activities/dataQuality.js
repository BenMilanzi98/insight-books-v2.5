/**
 * Activity data-quality foundations — Phase 13 Wave 4.
 * Light checks only. Never invent DQ scores or false zeroes on gate failure.
 */

import { resolveCrmAccess } from '../authz.js';
import { CRM_RELIABILITY_STATUS } from '../catalogue.js';
import { hasCrmActivityModel } from './model.js';

export const CRM_ACTIVITY_DQ_VERSION = 'crm-activity-dq-v1-2026-07-30';

async function safeCount(fn) {
  try {
    const value = await fn();
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return { ok: false, value: null };
    }
    return { ok: true, value };
  } catch {
    return { ok: false, value: null };
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object }} args
 */
export async function evaluateActivityDataQuality(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewActivities &&
    !access.canViewLeads &&
    !access.canRunReconciliation
  ) {
    return {
      ok: false,
      forbidden: true,
      status: CRM_RELIABILITY_STATUS.PERMISSION_RESTRICTED,
      reason: 'crm_activity_dq_forbidden',
      checks: null,
    };
  }

  if (!hasCrmActivityModel(prisma)) {
    return {
      ok: true,
      status: CRM_RELIABILITY_STATUS.NOT_INSTRUMENTED,
      reason: 'crm_activity_model_unavailable',
      checks: null,
      honesty: { inventZeroesForbidden: true, falseZeroes: false },
      definitionVersion: CRM_ACTIVITY_DQ_VERSION,
    };
  }

  const total = await safeCount(() => prisma.crmActivity.count());
  const missingSubject = await safeCount(() =>
    prisma.crmActivity.count({
      where: {
        OR: [{ primarySubjectType: null }, { primarySubjectId: null }],
      },
    })
  );
  const missingTimezone = await safeCount(() =>
    prisma.crmActivity.count({ where: { timezone: null } })
  );

  if (!total.ok || !missingSubject.ok || !missingTimezone.ok) {
    return {
      ok: true,
      status: CRM_RELIABILITY_STATUS.RECONCILIATION_FAILED,
      reason: 'activity_dq_gate_failed',
      checks: null,
      honesty: { inventZeroesForbidden: true, falseZeroes: false },
      definitionVersion: CRM_ACTIVITY_DQ_VERSION,
    };
  }

  if (total.value === 0) {
    return {
      ok: true,
      status: 'EMPTY',
      checks: {
        totalActivities: null,
        missingPrimarySubject: null,
        missingTimezone: null,
      },
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        emptyEnvelope: true,
      },
      definitionVersion: CRM_ACTIVITY_DQ_VERSION,
    };
  }

  return {
    ok: true,
    status: CRM_RELIABILITY_STATUS.AVAILABLE,
    checks: {
      totalActivities: total.value,
      missingPrimarySubject: missingSubject.value,
      missingTimezone: missingTimezone.value,
    },
    honesty: { inventZeroesForbidden: true, falseZeroes: false },
    definitionVersion: CRM_ACTIVITY_DQ_VERSION,
  };
}
