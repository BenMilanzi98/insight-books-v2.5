/**
 * Activity reconciliation foundations — Phase 13 Wave 4.
 * Extends CRM recon honesty: Activity plane checks never invent zeroes.
 */

import { resolveCrmAccess } from '../authz.js';
import { CRM_RELIABILITY_STATUS, CRM_RECON_VERSION } from '../catalogue.js';
import { applyCrmReconHonesty } from '../reconciliation.js';
import { hasCrmActivityModel } from './model.js';

export const CRM_ACTIVITY_RECON_VERSION = 'crm-activity-recon-v1-2026-07-30';

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
 * @param {{ admin: object, persist?: boolean }} args
 */
export async function runActivityReconciliation(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canRunReconciliation && !access.isSuperAdmin) {
    return {
      ok: false,
      forbidden: true,
      status: CRM_RELIABILITY_STATUS.PERMISSION_RESTRICTED,
      reason: 'crm_activity_recon_forbidden',
    };
  }

  if (!hasCrmActivityModel(prisma)) {
    const honesty = applyCrmReconHonesty({
      status: CRM_RELIABILITY_STATUS.NOT_INSTRUMENTED,
    });
    return {
      ok: true,
      status: honesty.status,
      cards: null,
      honesty: {
        ...honesty,
        inventZeroesForbidden: true,
        activityPlane: true,
      },
      definitionVersion: CRM_ACTIVITY_RECON_VERSION,
      parentReconVersion: CRM_RECON_VERSION,
    };
  }

  const activityCount = await safeCount(() => prisma.crmActivity.count());
  const orphanTasks =
    typeof prisma?.crmTask?.count === 'function'
      ? await safeCount(() =>
          prisma.crmTask.count({ where: { activityId: null } })
        )
      : { ok: true, value: null };

  if (!activityCount.ok) {
    const honesty = applyCrmReconHonesty({
      status: CRM_RELIABILITY_STATUS.RECONCILIATION_FAILED,
      reconOk: false,
    });
    return {
      ok: true,
      status: honesty.status,
      cards: null,
      honesty: { ...honesty, inventZeroesForbidden: true, activityPlane: true },
      definitionVersion: CRM_ACTIVITY_RECON_VERSION,
    };
  }

  if (activityCount.value === 0) {
    return {
      ok: true,
      status: 'EMPTY',
      cards: null,
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        emptyEnvelope: true,
        activityPlane: true,
        kpiSafe: false,
      },
      definitionVersion: CRM_ACTIVITY_RECON_VERSION,
    };
  }

  const cards = [
    {
      id: 'activity_count',
      label: 'CrmActivity rows',
      value: activityCount.value,
      status: CRM_RELIABILITY_STATUS.AVAILABLE,
    },
    {
      id: 'tasks_without_activity',
      label: 'CrmTask without activityId',
      value: orphanTasks.ok ? orphanTasks.value : null,
      status: orphanTasks.ok
        ? CRM_RELIABILITY_STATUS.AVAILABLE
        : CRM_RELIABILITY_STATUS.UNAVAILABLE,
      detail: orphanTasks.ok
        ? null
        : 'task orphan count unavailable — KPI null (never invent 0)',
    },
  ];

  return {
    ok: true,
    status: CRM_RELIABILITY_STATUS.AVAILABLE,
    cards,
    honesty: {
      inventZeroesForbidden: true,
      falseZeroes: false,
      activityPlane: true,
      kpiSafe: true,
    },
    definitionVersion: CRM_ACTIVITY_RECON_VERSION,
    parentReconVersion: CRM_RECON_VERSION,
  };
}
