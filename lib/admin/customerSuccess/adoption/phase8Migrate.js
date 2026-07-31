/**
 * Phase 8 CsSuccessPlan → Adoption Plan link migration — Phase 19 Wave 4.
 * Manage-only. Link only on explicit unique match rules; else UNKNOWN.
 * Never invent COMPLETED. Broken links stay UNKNOWN.
 */

import {
  canManageAdoption,
  hasCustomerAdoptionPlanModel,
  resolveAdoptionActor,
} from './model.js';
import { getAdoptionDomainContract } from './catalogue.js';
import { getFoundationStatus } from '../foundations.js';

/**
 * Explicit match: unique Adoption Plan by tenantId (+ customerId when present).
 * Ambiguous multi-plan or zero matches → null (caller marks UNKNOWN).
 */
async function resolveExplicitPlanMatch(prisma, row) {
  if (!row?.tenantId || typeof prisma.customerAdoptionPlan.findMany !== 'function') {
    return null;
  }

  const where = { tenantId: String(row.tenantId) };
  if (row.customerId) {
    where.customerId = String(row.customerId);
  }

  const matches = await prisma.customerAdoptionPlan.findMany({ where });
  if (!matches || matches.length !== 1) {
    return null;
  }
  return matches[0];
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, actorContext?: object }} args
 */
export async function migratePhase8SuccessPlans(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, error: 'phase8_migrate_forbidden' };
  }

  if (!hasCustomerAdoptionPlanModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_plan_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  if (typeof prisma.csSuccessPlan?.findMany !== 'function') {
    return {
      ok: true,
      linked: 0,
      unknown: 0,
      reason: 'cs_success_plan_model_unavailable',
    };
  }

  let rows = [];
  try {
    rows = await prisma.csSuccessPlan.findMany({
      where: { adoptionPlanId: null },
    });
  } catch {
    try {
      const all = await prisma.csSuccessPlan.findMany({});
      rows = (all || []).filter((r) => r.adoptionPlanId == null);
    } catch {
      return {
        ok: false,
        error: 'cs_success_plan_query_failed',
      };
    }
  }

  let linked = 0;
  let unknown = 0;

  for (const row of rows || []) {
    if (row.adoptionPlanId) {
      const existing =
        typeof prisma.customerAdoptionPlan.findUnique === 'function'
          ? await prisma.customerAdoptionPlan.findUnique({
              where: { id: row.adoptionPlanId },
            })
          : null;
      if (!existing) {
        await prisma.csSuccessPlan.update({
          where: { id: row.id },
          data: {
            migrationStatus: 'UNKNOWN',
            status: row.status === 'COMPLETED' ? 'UNKNOWN' : row.status || 'UNKNOWN',
            completedAt: null,
          },
        });
        unknown += 1;
        continue;
      }
    }

    const plan = await resolveExplicitPlanMatch(prisma, row);

    if (plan) {
      await prisma.csSuccessPlan.update({
        where: { id: row.id },
        data: {
          adoptionPlanId: plan.id,
          migrationStatus: 'LINKED',
        },
      });
      // Bidirectional soft link on Adoption Plan when successPlanId empty
      if (!plan.successPlanId && typeof prisma.customerAdoptionPlan.update === 'function') {
        try {
          await prisma.customerAdoptionPlan.update({
            where: { id: plan.id },
            data: { successPlanId: row.id },
          });
        } catch {
          // non-fatal
        }
      }
      linked += 1;
    } else {
      await prisma.csSuccessPlan.update({
        where: { id: row.id },
        data: {
          migrationStatus: 'UNKNOWN',
          status: row.status === 'COMPLETED' ? 'UNKNOWN' : row.status || 'UNKNOWN',
          completedAt: null,
        },
      });
      unknown += 1;
    }
  }

  return {
    ok: true,
    linked,
    unknown,
    processed: (rows || []).length,
    inventCompletedForbidden: true,
    explicitMatchOnly: true,
    domain: getAdoptionDomainContract(),
  };
}

/**
 * Alias — foundations projects Adoption Plan when linked.
 */
export async function getFoundationStatusWithPlan(prisma, args = {}) {
  return getFoundationStatus(prisma, { ...args, kind: args.kind || 'plans' });
}
