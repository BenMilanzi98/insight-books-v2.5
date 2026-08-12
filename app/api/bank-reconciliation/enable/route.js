import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardBankReconRoute, accountingErrorResponse } from '@/lib/bankReconciliation/api/routeGuard.js';
import { BANK_RECON_PERMISSIONS } from '@/lib/bankReconciliation/permissions.js';
import { BANK_RECON_FLAGS, setFlag } from '@/lib/accountingV2/infrastructure/featureFlags.js';
import {
  listReconcilableAccounts,
  upsertConfiguration,
} from '@/lib/bankReconciliation/application/configService.js';

export async function POST(request) {
  const guard = await guardBankReconRoute(request, BANK_RECON_PERMISSIONS.CONFIGURE, {
    requireFlag: false,
  });
  if (guard.response) return guard.response;

  try {
    await setFlag(prisma, {
      tenantId: guard.context.businessId,
      flagKey: BANK_RECON_FLAGS.ENABLED,
      enabled: true,
      reason: 'Enabled from Bank Reconciliation workspace',
      updatedBy: guard.context.userId,
    });

    const accounts = await listReconcilableAccounts(prisma, guard.context.businessId);
    let configured = 0;
    for (const account of accounts) {
      try {
        await upsertConfiguration(prisma, guard.context, {
          paymentAccountId: account.id,
          enabled: true,
        });
        configured += 1;
      } catch {
        /* skip accounts that still fail CoA posting checks */
      }
    }

    return NextResponse.json({
      enabled: true,
      flag: BANK_RECON_FLAGS.ENABLED,
      reconcilableAccounts: accounts.length,
      configurationsCreated: configured,
    });
  } catch (error) {
    return accountingErrorResponse(error, 'enable bank reconciliation');
  }
}
