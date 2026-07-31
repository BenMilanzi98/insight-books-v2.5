/**
 * Engagement health dimension — login proxy only (not product adoption).
 */

import { loadEngagementProxy } from '@/lib/admin/customers/engagement.js';
import { DIMENSION_CODES, DIMENSION_STATUS } from '../catalogue.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {{ now?: Date, engagement?: object, baseWeight?: number }} [opts]
 */
export async function scoreEngagementDimension(prisma, tenantId, opts = {}) {
  const code = DIMENSION_CODES.ENGAGEMENT;
  const baseWeight = opts.baseWeight ?? 0.25;
  const now = opts.now || new Date();

  let engagement = opts.engagement;
  if (!engagement) {
    try {
      engagement = await loadEngagementProxy(prisma, tenantId, { now });
    } catch (e) {
      return {
        code,
        status: DIMENSION_STATUS.FAILED,
        score: null,
        baseWeight,
        effectiveWeight: 0,
        drivers: [],
        reason: e?.message || 'Engagement query threw',
      };
    }
  }

  if (!engagement?.ok) {
    return {
      code,
      status: DIMENSION_STATUS.FAILED,
      score: null,
      baseWeight,
      effectiveWeight: 0,
      drivers: [],
      reason: engagement?.reason || 'Engagement unavailable',
    };
  }

  const lastLoginAt = engagement.lastLoginAt;
  const drivers = [];
  let score;
  let daysSince = null;

  if (!lastLoginAt) {
    // Absence of login is evidence — SCORED low, never treat as missing→0 weight abuse
    score = 12;
    drivers.push({
      code: 'never_logged_in',
      impact: -88,
      detail: 'User.lastLogin null for all tenant users (login proxy)',
    });
  } else {
    const loginDate = new Date(lastLoginAt);
    daysSince = Math.max(0, (now.getTime() - loginDate.getTime()) / 864e5);
    if (daysSince <= 7) {
      score = 95;
      drivers.push({ code: 'login_recent_7d', impact: 0, detail: `daysSince=${daysSince.toFixed(1)}` });
    } else if (daysSince <= 30) {
      score = 80;
      drivers.push({ code: 'login_within_30d', impact: -15, detail: `daysSince=${daysSince.toFixed(1)}` });
    } else if (daysSince <= 60) {
      score = 55;
      drivers.push({ code: 'login_stale_60d', impact: -40, detail: `daysSince=${daysSince.toFixed(1)}` });
    } else if (daysSince <= 90) {
      score = 35;
      drivers.push({ code: 'login_stale_90d', impact: -60, detail: `daysSince=${daysSince.toFixed(1)}` });
    } else {
      score = 18;
      drivers.push({ code: 'login_very_stale', impact: -77, detail: `daysSince=${daysSince.toFixed(1)}` });
    }
  }

  drivers.push({
    code: 'login_proxy_limitation',
    impact: 0,
    detail: 'Engagement is login proxy — not product FEATURE_USED / adoption',
  });

  return {
    code,
    status: DIMENSION_STATUS.SCORED,
    score,
    baseWeight,
    effectiveWeight: 0,
    drivers,
    facts: {
      lastLoginAt,
      daysSinceLogin: daysSince,
      activeUsersProxy: engagement.activeUsersProxy ?? null,
      limitations: engagement.limitations,
    },
  };
}
