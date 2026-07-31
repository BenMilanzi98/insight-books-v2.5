/**
 * /api/accounting-v2/periods/migration
 *
 * POST — {action: 'preview'|'execute', dryRun?} legacy period migration for
 * the session business. Execution requires the migration permission; the
 * batch is fully audited and never modifies journal dates or amounts.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import {
  previewLegacyPeriodMigration,
  executeLegacyPeriodMigration,
} from '@/lib/accountingV2/periods/legacyPeriodMigrationService.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? 'preview');
  const guard = await guardAccountingRoute(
    request,
    action === 'execute'
      ? [ACCOUNTING_PERMISSIONS.PERIODS_MIGRATE]
      : [ACCOUNTING_PERMISSIONS.PERIODS_MIGRATE, ACCOUNTING_PERMISSIONS.PERIODS_VIEW]
  );
  if (guard.response) return guard.response;
  try {
    if (action === 'execute') {
      const result = await executeLegacyPeriodMigration(prisma, guard.context, {
        dryRun: body.dryRun === true,
      });
      return NextResponse.json(result);
    }
    const preview = await previewLegacyPeriodMigration(prisma, guard.context);
    return NextResponse.json(preview);
  } catch (error) {
    return accountingErrorResponse(error, `period migration ${action}`);
  }
}
