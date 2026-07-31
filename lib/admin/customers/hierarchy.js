/**
 * Tenant hierarchy counts — Branch / User / active users.
 */

import {
  METRIC_STATUS,
  metricEnvelope,
  unavailableMetric,
} from '@/lib/admin/intelligence/metricStates.js';
import { CUSTOMER_METRIC_CODES, CUSTOMER_READINESS } from './catalogue.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 */
export async function loadHierarchyCounts(prisma, tenantId) {
  if (!tenantId) {
    return {
      ok: false,
      branchCount: null,
      userCount: null,
      activeUserCount: null,
      status: CUSTOMER_READINESS.UNAVAILABLE,
      reason: 'tenantId required',
    };
  }

  try {
    const [branchCount, userCount, activeUserCount] = await Promise.all([
      prisma.branch.count({ where: { tenantId } }),
      prisma.user.count({ where: { tenantId } }),
      prisma.user.count({
        where: {
          tenantId,
          isActive: true,
          status: { in: ['active', 'ACTIVE'] },
        },
      }),
    ]);

    return {
      ok: true,
      branchCount,
      userCount,
      activeUserCount,
      status: CUSTOMER_READINESS.READY_WITH_LIMITATIONS,
      limitations:
        'activeUserCount uses User.isActive + status active; not login-based engagement.',
    };
  } catch (e) {
    return {
      ok: false,
      branchCount: null,
      userCount: null,
      activeUserCount: null,
      status: CUSTOMER_READINESS.UNAVAILABLE,
      reason: e?.message || 'Hierarchy query failed',
    };
  }
}

/**
 * Hierarchy section for Customer 360 (counts + envelopes).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 */
export async function buildHierarchySection(prisma, tenantId) {
  const counts = await loadHierarchyCounts(prisma, tenantId);

  if (!counts.ok) {
    return {
      branchCount: null,
      userCount: null,
      activeUserCount: null,
      status: CUSTOMER_READINESS.UNAVAILABLE,
      reason: counts.reason,
      envelopes: {
        [CUSTOMER_METRIC_CODES.BRANCH_COUNT]: unavailableMetric(
          CUSTOMER_METRIC_CODES.BRANCH_COUNT,
          counts.reason || 'Hierarchy unavailable',
          { status: METRIC_STATUS.UNAVAILABLE, reasonCode: 'query_failed', unit: 'count' }
        ),
        [CUSTOMER_METRIC_CODES.USER_COUNT]: unavailableMetric(
          CUSTOMER_METRIC_CODES.USER_COUNT,
          counts.reason || 'Hierarchy unavailable',
          { status: METRIC_STATUS.UNAVAILABLE, reasonCode: 'query_failed', unit: 'count' }
        ),
        [CUSTOMER_METRIC_CODES.ACTIVE_USER_COUNT]: unavailableMetric(
          CUSTOMER_METRIC_CODES.ACTIVE_USER_COUNT,
          counts.reason || 'Hierarchy unavailable',
          { status: METRIC_STATUS.UNAVAILABLE, reasonCode: 'query_failed', unit: 'count' }
        ),
      },
    };
  }

  const lim = counts.limitations;
  return {
    branchCount: counts.branchCount,
    userCount: counts.userCount,
    activeUserCount: counts.activeUserCount,
    status: CUSTOMER_READINESS.READY_WITH_LIMITATIONS,
    limitations: lim,
    envelopes: {
      [CUSTOMER_METRIC_CODES.BRANCH_COUNT]: metricEnvelope({
        code: CUSTOMER_METRIC_CODES.BRANCH_COUNT,
        status: METRIC_STATUS.READY,
        value: counts.branchCount,
        unit: 'count',
        label: 'Branch count',
        source: 'Branch',
      }),
      [CUSTOMER_METRIC_CODES.USER_COUNT]: metricEnvelope({
        code: CUSTOMER_METRIC_CODES.USER_COUNT,
        status: METRIC_STATUS.READY_WITH_LIMITATIONS,
        value: counts.userCount,
        unit: 'count',
        label: 'User count',
        source: 'User',
        limitations: lim,
      }),
      [CUSTOMER_METRIC_CODES.ACTIVE_USER_COUNT]: metricEnvelope({
        code: CUSTOMER_METRIC_CODES.ACTIVE_USER_COUNT,
        status: METRIC_STATUS.READY_WITH_LIMITATIONS,
        value: counts.activeUserCount,
        unit: 'count',
        label: 'Active user count',
        source: 'User.isActive/status',
        limitations: lim,
      }),
    },
  };
}
