/**
 * Phase 8 CsTrainingRecord → Program link migration — Phase 18 Wave 4.
 * Manage-only. Link only on explicit unique match rules; else UNKNOWN.
 * Never invent COMPLETED. Broken links stay UNKNOWN.
 */

import {
  canManageTraining,
  hasCustomerTrainingProgramModel,
  resolveTrainingActor,
} from './model.js';
import { getTrainingDomainContract } from './catalogue.js';
import { getFoundationStatus } from '../foundations.js';

/**
 * Explicit match: unique Program by tenantId (+ customerId when present on the record).
 * Ambiguous multi-program or zero matches → null (caller marks UNKNOWN).
 */
async function resolveExplicitProgramMatch(prisma, row) {
  if (!row?.tenantId || typeof prisma.customerTrainingProgram.findMany !== 'function') {
    return null;
  }

  const where = { tenantId: String(row.tenantId) };
  if (row.customerId) {
    where.customerId = String(row.customerId);
  }

  const matches = await prisma.customerTrainingProgram.findMany({ where });
  if (!matches || matches.length !== 1) {
    return null;
  }
  return matches[0];
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, actorContext?: object }} args
 */
export async function migratePhase8TrainingRecords(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, error: 'phase8_migrate_forbidden' };
  }

  if (!hasCustomerTrainingProgramModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_program_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  if (typeof prisma.csTrainingRecord?.findMany !== 'function') {
    return {
      ok: true,
      linked: 0,
      unknown: 0,
      reason: 'cs_training_record_model_unavailable',
    };
  }

  let rows = [];
  try {
    rows = await prisma.csTrainingRecord.findMany({
      where: { trainingProgramId: null },
    });
  } catch {
    try {
      const all = await prisma.csTrainingRecord.findMany({});
      rows = (all || []).filter((r) => r.trainingProgramId == null);
    } catch {
      return {
        ok: false,
        error: 'cs_training_record_query_failed',
      };
    }
  }

  let linked = 0;
  let unknown = 0;

  for (const row of rows || []) {
    if (row.trainingProgramId) {
      const existing =
        typeof prisma.customerTrainingProgram.findUnique === 'function'
          ? await prisma.customerTrainingProgram.findUnique({
              where: { id: row.trainingProgramId },
            })
          : null;
      if (!existing) {
        await prisma.csTrainingRecord.update({
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

    const program = await resolveExplicitProgramMatch(prisma, row);

    if (program) {
      await prisma.csTrainingRecord.update({
        where: { id: row.id },
        data: {
          trainingProgramId: program.id,
          migrationStatus: 'LINKED',
        },
      });
      linked += 1;
    } else {
      await prisma.csTrainingRecord.update({
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
    domain: getTrainingDomainContract(),
  };
}

/**
 * Alias — foundations projects Program when linked; exported for Wave 4 API.
 */
export async function getFoundationStatusWithProgram(prisma, args = {}) {
  return getFoundationStatus(prisma, { ...args, kind: args.kind || 'training' });
}
