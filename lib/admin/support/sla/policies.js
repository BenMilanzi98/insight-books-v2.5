/**
 * Versioned Support SLA policies — FIRST_RESPONSE / RESOLUTION targets.
 * NEXT_RESPONSE is an optional stub target.
 */

import {
  SUPPORT_DEFAULT_SLA_POLICY_VERSION_ID,
  SUPPORT_SLA_CLOCK_TYPE,
} from './catalogue.js';
import { SUPPORT_WAITING_STATUSES, SUPPORT_TICKET_STATUS } from '../catalogue.js';
import { resolveSupportAccess } from '../authz.js';

const HOUR = 60 * 60 * 1000;

/**
 * Default pinned policy (ack does NOT count as first response).
 */
export function getDefaultSlaPolicy() {
  return Object.freeze({
    versionId: SUPPORT_DEFAULT_SLA_POLICY_VERSION_ID,
    name: 'Default Support SLA',
    ackCountsAsFirstResponse: false,
    /** Start RESOLUTION on ticket create (ASSIGN = start on first assign — future). */
    resolutionStartsOn: 'CREATE',
    /** Stop RESOLUTION when ticket reaches CLOSED (after RESOLVED). */
    stopResolutionOnClosed: true,
    pauseOnWaitingForCustomer: true,
    pauseOnWaitingForInternalTeam: true,
    pauseOnWaitingForVendor: true,
    targets: Object.freeze({
      [SUPPORT_SLA_CLOCK_TYPE.FIRST_RESPONSE]: Object.freeze({ businessMs: 4 * HOUR }),
      [SUPPORT_SLA_CLOCK_TYPE.RESOLUTION]: Object.freeze({ businessMs: 24 * HOUR }),
      [SUPPORT_SLA_CLOCK_TYPE.NEXT_RESPONSE]: Object.freeze({ businessMs: 8 * HOUR }),
    }),
  });
}

function mapPolicyRow(row) {
  if (!row) return null;
  return {
    versionId: row.versionId,
    name: row.name,
    ackCountsAsFirstResponse: Boolean(row.ackCountsAsFirstResponse),
    resolutionStartsOn: row.resolutionStartsOn || 'CREATE',
    stopResolutionOnClosed: row.stopResolutionOnClosed !== false,
    pauseOnWaitingForCustomer: row.pauseOnWaitingForCustomer !== false,
    pauseOnWaitingForInternalTeam: row.pauseOnWaitingForInternalTeam !== false,
    pauseOnWaitingForVendor: row.pauseOnWaitingForVendor !== false,
    targets:
      typeof row.targetsJson === 'string'
        ? JSON.parse(row.targetsJson)
        : row.targetsJson || getDefaultSlaPolicy().targets,
    source: 'db',
  };
}

/**
 * Load a policy by pinned version id. Catalogue default or DB row; null if missing.
 * Never invents a newer catalogue default for an unknown version.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} versionId
 * @returns {Promise<object|null>}
 */
export async function getSlaPolicyByVersion(prisma, versionId) {
  const id = String(versionId || '').trim();
  if (!id) return null;

  const catalogue = getDefaultSlaPolicy();
  if (id === catalogue.versionId) return catalogue;

  if (typeof prisma?.supportSlaPolicy?.findUnique === 'function') {
    try {
      const row = await prisma.supportSlaPolicy.findUnique({ where: { versionId: id } });
      if (row) return mapPolicyRow(row);
    } catch {
      // fall through
    }
  }
  if (typeof prisma?.supportSlaPolicy?.findFirst === 'function') {
    try {
      const row = await prisma.supportSlaPolicy.findFirst({ where: { versionId: id } });
      if (row) return mapPolicyRow(row);
    } catch {
      // fall through
    }
  }
  return null;
}

/**
 * @param {object} policy
 * @param {string} status
 */
export function shouldPauseForStatus(policy, status) {
  const s = String(status || '').toUpperCase();
  if (s === SUPPORT_TICKET_STATUS.WAITING_FOR_CUSTOMER) {
    return Boolean(policy?.pauseOnWaitingForCustomer);
  }
  if (s === SUPPORT_TICKET_STATUS.WAITING_FOR_INTERNAL_TEAM) {
    return Boolean(policy?.pauseOnWaitingForInternalTeam);
  }
  if (s === SUPPORT_TICKET_STATUS.WAITING_FOR_VENDOR) {
    return Boolean(policy?.pauseOnWaitingForVendor);
  }
  return SUPPORT_WAITING_STATUSES.includes(s);
}

/**
 * List policies. DB table optional — falls back to default catalogue.
 * Readable with viewTickets; mutations gated by manageSla (none in Wave 3 UI).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object }} args
 */
export async function listSlaPolicies(prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canViewTickets) {
    return { ok: false, forbidden: true, reason: 'support_view_forbidden', items: [] };
  }

  if (typeof prisma?.supportSlaPolicy?.findMany === 'function') {
    try {
      const rows = await prisma.supportSlaPolicy.findMany({
        where: { active: true },
        orderBy: { versionId: 'asc' },
      });
      if (rows?.length) {
        return {
          ok: true,
          items: rows.map((r) => ({
            versionId: r.versionId,
            name: r.name,
            ackCountsAsFirstResponse: Boolean(r.ackCountsAsFirstResponse),
            resolutionStartsOn: r.resolutionStartsOn || 'CREATE',
            stopResolutionOnClosed: r.stopResolutionOnClosed !== false,
            pauseOnWaitingForCustomer: r.pauseOnWaitingForCustomer !== false,
            pauseOnWaitingForInternalTeam: r.pauseOnWaitingForInternalTeam !== false,
            pauseOnWaitingForVendor: r.pauseOnWaitingForVendor !== false,
            targets: typeof r.targetsJson === 'string'
              ? JSON.parse(r.targetsJson)
              : r.targetsJson || getDefaultSlaPolicy().targets,
            source: 'db',
          })),
        };
      }
    } catch {
      // fall through to catalogue default
    }
  }

  return {
    ok: true,
    items: [{ ...getDefaultSlaPolicy(), source: 'catalogue' }],
    meta: { catalogueFallback: true },
  };
}
