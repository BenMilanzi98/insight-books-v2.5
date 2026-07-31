/**
 * Phase 8 CsOnboardingRecord → Project link migration — Phase 17 Wave 4.
 * Manage-only. Link only on explicit unique match rules; else UNKNOWN.
 * Never invent COMPLETED. Broken links stay UNKNOWN.
 */

import {
  canManageOnboarding,
  hasCustomerOnboardingProjectModel,
  resolveOnboardingActor,
} from './model.js';
import { getOnboardingDomainContract } from './catalogue.js';
import { getFoundationStatus } from '../foundations.js';

/**
 * Explicit match: unique Project by tenantId (+ customerId when present on the record).
 * Ambiguous multi-project or zero matches → null (caller marks UNKNOWN).
 */
async function resolveExplicitProjectMatch(prisma, row) {
  if (!row?.tenantId || typeof prisma.customerOnboardingProject.findMany !== 'function') {
    return null;
  }

  const where = { tenantId: String(row.tenantId) };
  if (row.customerId) {
    where.customerId = String(row.customerId);
  }

  const matches = await prisma.customerOnboardingProject.findMany({ where });
  if (!matches || matches.length !== 1) {
    return null;
  }
  return matches[0];
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, actorContext?: object }} args
 */
export async function migratePhase8OnboardingRecords(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, error: 'phase8_migrate_forbidden' };
  }

  if (!hasCustomerOnboardingProjectModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_project_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  if (typeof prisma.csOnboardingRecord?.findMany !== 'function') {
    return {
      ok: true,
      linked: 0,
      unknown: 0,
      reason: 'cs_onboarding_record_model_unavailable',
    };
  }

  let rows = [];
  try {
    rows = await prisma.csOnboardingRecord.findMany({
      where: { onboardingProjectId: null },
    });
  } catch {
    try {
      const all = await prisma.csOnboardingRecord.findMany({});
      rows = (all || []).filter((r) => r.onboardingProjectId == null);
    } catch {
      return {
        ok: false,
        error: 'cs_onboarding_record_query_failed',
      };
    }
  }

  let linked = 0;
  let unknown = 0;

  for (const row of rows || []) {
    // Broken pre-existing link (id set but Project missing) stays UNKNOWN — skip re-link invent
    if (row.onboardingProjectId) {
      const existing =
        typeof prisma.customerOnboardingProject.findUnique === 'function'
          ? await prisma.customerOnboardingProject.findUnique({
              where: { id: row.onboardingProjectId },
            })
          : null;
      if (!existing) {
        await prisma.csOnboardingRecord.update({
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

    const project = await resolveExplicitProjectMatch(prisma, row);

    if (project) {
      await prisma.csOnboardingRecord.update({
        where: { id: row.id },
        data: {
          onboardingProjectId: project.id,
          migrationStatus: 'LINKED',
        },
      });
      linked += 1;
    } else {
      await prisma.csOnboardingRecord.update({
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
    domain: getOnboardingDomainContract(),
  };
}

/**
 * Alias — foundations already projects Project when linked; exported for Wave 4 API.
 */
export async function getFoundationStatusWithProject(prisma, args = {}) {
  return getFoundationStatus(prisma, args);
}
