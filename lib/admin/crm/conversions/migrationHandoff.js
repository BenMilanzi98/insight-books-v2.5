/**
 * Data migration handoff — Phase 16 Wave 4.
 * Idempotent payload only. Never runs Production import.
 */

import {
  createDomainHandoff,
  CRM_CONVERSION_HANDOFF_TYPE,
} from './handoffShared.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, conversionId?: string, tenantId?: string, idempotencyKey: string, payload?: object, now?: Date }} args
 */
export async function createDataMigrationHandoff(prisma, args = {}) {
  const result = await createDomainHandoff(prisma, {
    ...args,
    handoffType: CRM_CONVERSION_HANDOFF_TYPE.MIGRATION,
    payload: {
      type: 'CRM_DATA_MIGRATION_HANDOFF',
      conversionId: args.conversionId || null,
      tenantId: args.tenantId || null,
      ...(args.payload && typeof args.payload === 'object' ? args.payload : {}),
      // Force after spread — caller cannot forge production import execution.
      productionImportExecuted: false,
    },
  });

  if (!result.ok) return result;

  return {
    ...result,
    productionImportExecuted: false,
    meta: {
      handoffOnly: true,
      executesMigration: false,
      productionImportForbidden: true,
    },
  };
}
