/**
 * Customer Success assignment for Closed-Won conversion — Phase 16 Wave 4.
 * Ownership row only. Never fabricates health scores.
 */

import { resolveCrmAccess } from '../authz.js';
import { resolveConversionActor, hasCrmConversionModel } from './model.js';

export function hasCrmConversionCsAssignmentModel(prisma) {
  return typeof prisma?.crmConversionCsAssignment?.create === 'function';
}

function serializeAssignment(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversionId: row.conversionId || null,
    tenantId: row.tenantId || null,
    ownerAdminId: row.ownerAdminId || null,
    portfolioId: row.portfolioId || null,
    ownershipId: row.ownershipId || null,
    idempotencyKey: row.idempotencyKey || null,
    status: row.status || 'ASSIGNED',
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    healthScore: null,
    fabricatedHealth: false,
  };
}

/**
 * Assign CS owner for a conversion tenant (idempotent).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin?: object,
 *   conversionId?: string,
 *   tenantId: string,
 *   ownerAdminId: string,
 *   portfolioId?: string|null,
 *   idempotencyKey: string,
 *   reason?: string,
 *   now?: Date,
 * }} args
 */
export async function assignCustomerSuccessOwner(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const access = resolveCrmAccess(admin);
  if (
    !access.canEditOpportunities &&
    !access.isSuperAdmin
  ) {
    return { ok: false, forbidden: true, reason: 'crm_cs_assign_forbidden' };
  }

  if (!hasCrmConversionCsAssignmentModel(prisma)) {
    return {
      ok: false,
      error: 'crm_conversion_cs_assignment_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const tenantId = args.tenantId ? String(args.tenantId).trim() : '';
  const ownerAdminId = args.ownerAdminId ? String(args.ownerAdminId).trim() : '';
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!tenantId || !ownerAdminId || !idempotencyKey) {
    return {
      ok: false,
      error: 'tenantId_ownerAdminId_idempotencyKey_required',
    };
  }

  const existing = await prisma.crmConversionCsAssignment.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      ok: true,
      alreadyExists: true,
      idempotentReplay: true,
      assignment: serializeAssignment(existing),
      healthScore: null,
      fabricatedHealth: false,
      created: false,
    };
  }

  if (typeof prisma.tenant?.findUnique === 'function') {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      return { ok: false, notFound: true, error: 'tenant_not_found' };
    }
  }

  const now = args.now || new Date();
  let ownershipId = null;

  if (typeof prisma.customerOwnership?.create === 'function') {
    if (typeof prisma.customerOwnership.updateMany === 'function') {
      await prisma.customerOwnership.updateMany({
        where: {
          tenantId,
          isPrimary: true,
          status: 'ACTIVE',
        },
        data: {
          status: 'ENDED',
          endAt: now,
          reason: args.reason
            ? `Reassigned: ${args.reason}`
            : 'Reassigned by conversion CS assign',
        },
      });
    }

    const ownership = await prisma.customerOwnership.create({
      data: {
        tenantId,
        portfolioId: args.portfolioId ? String(args.portfolioId) : null,
        ownerAdminId,
        assignmentType: 'CUSTOMER_SUCCESS_OWNER',
        isPrimary: true,
        startAt: now,
        reason: args.reason
          ? String(args.reason).trim()
          : 'Closed-Won conversion CS assignment',
        assignedByAdminId: admin?.id || null,
        status: 'ACTIVE',
      },
    });
    ownershipId = ownership.id;
  }

  const row = await prisma.crmConversionCsAssignment.create({
    data: {
      conversionId: args.conversionId ? String(args.conversionId) : null,
      tenantId,
      ownerAdminId,
      portfolioId: args.portfolioId ? String(args.portfolioId) : null,
      ownershipId,
      idempotencyKey,
      status: 'ASSIGNED',
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
      metaJson: {
        healthScore: null,
        fabricatedHealth: false,
        conversionPlane: true,
        hasCrmConversionModel: hasCrmConversionModel(prisma),
      },
    },
  });

  return {
    ok: true,
    created: true,
    assignment: serializeAssignment(row),
    healthScore: null,
    fabricatedHealth: false,
    meta: {
      ownershipCreated: Boolean(ownershipId),
      inventHealthForbidden: true,
    },
  };
}
