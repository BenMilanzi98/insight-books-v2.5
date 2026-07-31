/**
 * Training handoff — Phase 16 Wave 4.
 * Idempotent payload only. Never fabricates training complete.
 */

import {
  createDomainHandoff,
  CRM_CONVERSION_HANDOFF_TYPE,
} from './handoffShared.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, conversionId?: string, tenantId?: string, idempotencyKey: string, payload?: object, now?: Date }} args
 */
export async function createTrainingHandoff(prisma, args = {}) {
  const result = await createDomainHandoff(prisma, {
    ...args,
    handoffType: CRM_CONVERSION_HANDOFF_TYPE.TRAINING,
    payload: {
      type: 'CRM_TRAINING_HANDOFF',
      conversionId: args.conversionId || null,
      tenantId: args.tenantId || null,
      ...(args.payload && typeof args.payload === 'object' ? args.payload : {}),
      // Force after spread — caller cannot forge training completion.
      trainingCompleted: false,
      fabricatedComplete: false,
      executionComplete: false,
    },
  });

  if (!result.ok) return result;

  return {
    ...result,
    trainingCompleted: false,
    fabricatedComplete: false,
    meta: {
      handoffOnly: true,
      executesTraining: false,
    },
  };
}
