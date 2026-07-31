/**
 * System segment helpers — code-defined filters (no dynamic engine).
 * Optional CustomerSegment / CustomerSegmentMembership tables exist for later waves.
 */

import { activeOwnershipWhere } from './portfolioScope.js';

export const SYSTEM_SEGMENT_CODES = Object.freeze({
  UNASSIGNED: 'system.unassigned',
  RENEWALS_DUE: 'system.renewals_due',
});

/**
 * Tenants with no ACTIVE CS ownership.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ now?: Date, take?: number }} [opts]
 */
export async function listUnassignedTenantIds(prisma, opts = {}) {
  const now = opts.now || new Date();
  const take = Math.min(2000, Math.max(1, parseInt(String(opts.take || 500), 10) || 500));

  if (!prisma?.customerOwnership?.findMany || !prisma?.tenant?.findMany) {
    return { ok: false, tenantIds: [], error: 'ownership_model_unavailable' };
  }

  try {
    const owned = await prisma.customerOwnership.findMany({
      where: activeOwnershipWhere(now),
      select: { tenantId: true },
    });
    const ownedSet = new Set((owned || []).map((r) => r.tenantId).filter(Boolean));
    const tenants = await prisma.tenant.findMany({
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
    const tenantIds = (tenants || [])
      .map((t) => t.id)
      .filter((id) => id && !ownedSet.has(id));
    return { ok: true, tenantIds, ownedCount: ownedSet.size };
  } catch (e) {
    return {
      ok: false,
      tenantIds: [],
      error: e?.message || 'unassigned_query_failed',
    };
  }
}

/**
 * Tenants with active subscription expiring within `withinDays`.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ now?: Date, withinDays?: number, take?: number }} [opts]
 */
export async function listRenewalsDueTenantIds(prisma, opts = {}) {
  const now = opts.now || new Date();
  const withinDays = Math.max(1, parseInt(String(opts.withinDays || 30), 10) || 30);
  const take = Math.min(2000, Math.max(1, parseInt(String(opts.take || 500), 10) || 500));
  const until = new Date(now.getTime() + withinDays * 864e5);

  if (!prisma?.accountSubscription?.findMany) {
    return { ok: false, tenantIds: [], error: 'subscription_model_unavailable' };
  }

  try {
    const rows = await prisma.accountSubscription.findMany({
      where: {
        isActive: true,
        expiresAt: { gt: now, lte: until },
        status: { notIn: ['Expired', 'expired', 'EXPIRED', 'cancelled', 'Cancelled'] },
      },
      select: { tenantId: true },
      take,
    });
    const tenantIds = [...new Set((rows || []).map((r) => r.tenantId).filter(Boolean))];
    return { ok: true, tenantIds, withinDays };
  } catch (e) {
    return {
      ok: false,
      tenantIds: [],
      error: e?.message || 'renewals_due_query_failed',
    };
  }
}

/**
 * Catalogue of system segment definitions (code-only).
 */
export function listSystemSegmentDefinitions() {
  return [
    {
      code: SYSTEM_SEGMENT_CODES.UNASSIGNED,
      name: 'Unassigned customers',
      description: 'Tenants with no ACTIVE CustomerOwnership row.',
      kind: 'SYSTEM',
    },
    {
      code: SYSTEM_SEGMENT_CODES.RENEWALS_DUE,
      name: 'Renewals due (30d)',
      description: 'Tenants with an active subscription expiring within 30 days.',
      kind: 'SYSTEM',
    },
  ];
}
