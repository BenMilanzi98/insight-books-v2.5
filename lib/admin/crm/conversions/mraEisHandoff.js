/**
 * MRA EIS handoff — Phase 16 Wave 4.
 * Idempotent payload only. Never submits fiscal or stores credentials.
 */

import {
  createDomainHandoff,
  CRM_CONVERSION_HANDOFF_TYPE,
} from './handoffShared.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, conversionId?: string, tenantId?: string, idempotencyKey: string, payload?: object, now?: Date }} args
 */
export async function createMraEisHandoff(prisma, args = {}) {
  const result = await createDomainHandoff(prisma, {
    ...args,
    handoffType: CRM_CONVERSION_HANDOFF_TYPE.MRA_EIS,
    payload: {
      type: 'CRM_MRA_EIS_HANDOFF',
      conversionId: args.conversionId || null,
      tenantId: args.tenantId || null,
      ...(args.payload && typeof args.payload === 'object' ? args.payload : {}),
      // Force after spread — caller cannot forge fiscal/credentials completion.
      fiscalSubmitted: false,
      credentialsStored: false,
      mraEisFiscalSubmitted: false,
    },
  });

  if (!result.ok) return result;

  return {
    ...result,
    fiscalSubmitted: false,
    credentialsStored: false,
    mraEisFiscalSubmitted: false,
    meta: {
      handoffOnly: true,
      executesMraFiscal: false,
      storesCredentials: false,
      mraFiscalForbidden: true,
    },
  };
}
