import { NextResponse } from 'next/server';
import prisma from '../../prisma.js';
import { guardAccountingRoute, accountingErrorResponse } from '../../accountingV2/api/routeGuard.js';
import { CLOSE_FLAGS, isFlagEnabled } from '../../accountingV2/infrastructure/featureFlags.js';

export { accountingErrorResponse };

export async function guardCloseRoute(request, permissions, { requireFlag = true } = {}) {
  const guard = await guardAccountingRoute(request, permissions);
  if (guard.response) return guard;

  if (requireFlag) {
    const enabled = await isFlagEnabled(prisma, CLOSE_FLAGS.ENABLED, {
      tenantId: guard.context.businessId,
    });
    if (!enabled) {
      return {
        response: NextResponse.json(
          {
            error: 'FEATURE_DISABLED',
            message: 'Accounting Close is not enabled for this business.',
            flag: CLOSE_FLAGS.ENABLED,
          },
          { status: 403 }
        ),
      };
    }
  }
  return guard;
}
