/**
 * Engagement proxies — User.lastLogin based. Not unique-user DAU.
 */

import {
  METRIC_STATUS,
  metricEnvelope,
  unavailableMetric,
} from '@/lib/admin/intelligence/metricStates.js';
import { CUSTOMER_METRIC_CODES, CUSTOMER_READINESS } from './catalogue.js';

export const ENGAGEMENT_LIMITATIONS =
  'Login-based proxy from User.lastLogin; not unique-user DAU/WAU/MAU. Meaningful product activity is not instrumented.';

const DEFAULT_ACTIVE_WINDOW_DAYS = 30;

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {{ now?: Date, activeWindowDays?: number }} [opts]
 */
export async function loadEngagementProxy(prisma, tenantId, opts = {}) {
  const now = opts.now || new Date();
  const days = Math.min(Math.max(Number(opts.activeWindowDays) || DEFAULT_ACTIVE_WINDOW_DAYS, 1), 365);
  const since = new Date(now.getTime() - days * 864e5);

  if (!tenantId) {
    return {
      ok: false,
      lastLoginAt: null,
      lastMeaningfulActivityAt: null,
      activeUsersProxy: null,
      status: CUSTOMER_READINESS.UNAVAILABLE,
      reason: 'tenantId required',
      limitations: ENGAGEMENT_LIMITATIONS,
    };
  }

  try {
    const [agg, activeUsersProxy] = await Promise.all([
      prisma.user.aggregate({
        where: { tenantId, lastLogin: { not: null } },
        _max: { lastLogin: true },
      }),
      prisma.user.count({
        where: {
          tenantId,
          lastLogin: { gte: since },
        },
      }),
    ]);

    const lastLoginAt = agg?._max?.lastLogin
      ? new Date(agg._max.lastLogin).toISOString()
      : null;

    return {
      ok: true,
      lastLoginAt,
      /** Meaningful activity not instrumented — always null with limitation */
      lastMeaningfulActivityAt: null,
      activeUsersProxy,
      activeWindowDays: days,
      status: CUSTOMER_READINESS.READY_WITH_LIMITATIONS,
      limitations: ENGAGEMENT_LIMITATIONS,
    };
  } catch (e) {
    return {
      ok: false,
      lastLoginAt: null,
      lastMeaningfulActivityAt: null,
      activeUsersProxy: null,
      status: CUSTOMER_READINESS.UNAVAILABLE,
      reason: e?.message || 'Engagement query failed',
      limitations: ENGAGEMENT_LIMITATIONS,
    };
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {{ now?: Date, activeWindowDays?: number }} [opts]
 */
export async function buildEngagementSection(prisma, tenantId, opts = {}) {
  const data = await loadEngagementProxy(prisma, tenantId, opts);

  if (!data.ok) {
    return {
      lastLoginAt: null,
      lastMeaningfulActivityAt: null,
      activeUsersProxy: null,
      limitations: data.limitations,
      status: CUSTOMER_READINESS.UNAVAILABLE,
      reason: data.reason,
      envelopes: {
        [CUSTOMER_METRIC_CODES.LAST_LOGIN]: unavailableMetric(
          CUSTOMER_METRIC_CODES.LAST_LOGIN,
          data.reason || 'Engagement unavailable',
          { status: METRIC_STATUS.UNAVAILABLE, reasonCode: 'query_failed' }
        ),
        [CUSTOMER_METRIC_CODES.ACTIVE_USERS_PROXY]: unavailableMetric(
          CUSTOMER_METRIC_CODES.ACTIVE_USERS_PROXY,
          data.reason || 'Engagement unavailable',
          { status: METRIC_STATUS.UNAVAILABLE, reasonCode: 'query_failed', unit: 'count' }
        ),
      },
    };
  }

  return {
    lastLoginAt: data.lastLoginAt,
    lastMeaningfulActivityAt: null,
    activeUsersProxy: data.activeUsersProxy,
    limitations: ENGAGEMENT_LIMITATIONS,
    status: CUSTOMER_READINESS.READY_WITH_LIMITATIONS,
    envelopes: {
      [CUSTOMER_METRIC_CODES.LAST_LOGIN]: metricEnvelope({
        code: CUSTOMER_METRIC_CODES.LAST_LOGIN,
        status: METRIC_STATUS.READY_WITH_LIMITATIONS,
        value: data.lastLoginAt,
        unit: 'datetime',
        label: 'Last login',
        source: 'User.lastLogin',
        limitations: ENGAGEMENT_LIMITATIONS,
      }),
      [CUSTOMER_METRIC_CODES.ACTIVE_USERS_PROXY]: metricEnvelope({
        code: CUSTOMER_METRIC_CODES.ACTIVE_USERS_PROXY,
        status: METRIC_STATUS.READY_WITH_LIMITATIONS,
        value: data.activeUsersProxy,
        unit: 'count',
        label: 'Active users (login proxy)',
        source: 'User.lastLogin',
        limitations: ENGAGEMENT_LIMITATIONS,
        period: {
          days: data.activeWindowDays,
        },
      }),
    },
  };
}
