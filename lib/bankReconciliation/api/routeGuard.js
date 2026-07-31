/**
 * Bank reconciliation API route guard — reuses accounting session context.
 */

import { guardAccountingRoute, accountingErrorResponse } from '../../accountingV2/api/routeGuard.js';
import { BANK_RECON_FLAGS, isFlagEnabled } from '../../accountingV2/infrastructure/featureFlags.js';
import prisma from '../../prisma.js';
import { NextResponse } from 'next/server';

export { accountingErrorResponse };

export async function guardBankReconRoute(request, permissions, { requireFlag = true } = {}) {
  const guard = await guardAccountingRoute(request, permissions);
  if (guard.response) return guard;

  if (requireFlag) {
    const enabled = await isFlagEnabled(prisma, BANK_RECON_FLAGS.ENABLED, {
      tenantId: guard.context.businessId,
    });
    if (!enabled) {
      return {
        response: NextResponse.json(
          {
            error: 'FEATURE_DISABLED',
            message: 'Bank Reconciliation is not enabled for this business.',
            flag: BANK_RECON_FLAGS.ENABLED,
          },
          { status: 403 }
        ),
      };
    }
  }

  return guard;
}
