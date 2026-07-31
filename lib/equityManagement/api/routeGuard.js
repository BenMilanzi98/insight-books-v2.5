import { NextResponse } from 'next/server';
import prisma from '../../prisma.js';
import { guardAccountingRoute, accountingErrorResponse } from '../../accountingV2/api/routeGuard.js';
import { EQUITY_FLAGS, isFlagEnabled } from '../../accountingV2/infrastructure/featureFlags.js';

export { accountingErrorResponse };

export async function guardEquityRoute(request, permissions, { requireFlag = true } = {}) {
  const guard = await guardAccountingRoute(request, permissions);
  if (guard.response) return guard;

  if (requireFlag) {
    const enabled = await isFlagEnabled(prisma, EQUITY_FLAGS.ENABLED, {
      tenantId: guard.context.businessId,
    });
    if (!enabled) {
      return {
        response: NextResponse.json(
          {
            error: 'FEATURE_DISABLED',
            message: 'Equity Management is not enabled for this business.',
            flag: EQUITY_FLAGS.ENABLED,
          },
          { status: 403 }
        ),
      };
    }
  }
  return guard;
}
