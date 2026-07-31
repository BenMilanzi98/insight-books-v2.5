/**
 * /api/accounting-v2/periods/financial-years
 *
 * GET  — list canonical financial years (with optional ?id= detail).
 * POST — {action: 'preview'|'create'|'open', startYear?, financialYearId?}
 *
 * Business always from the session; period/year ids are validated against
 * the session business inside the services.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import {
  previewFinancialYear,
  createFinancialYear,
  openFinancialYear,
  listFinancialYears,
  getFinancialYear,
} from '@/lib/accountingV2/periods/financialYearService.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.FY_VIEW,
    ACCOUNTING_PERMISSIONS.PERIODS_VIEW,
    ACCOUNTING_PERMISSIONS.VIEW,
  ]);
  if (guard.response) return guard.response;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const detail = await getFinancialYear(prisma, guard.context, id);
      return NextResponse.json(detail);
    }
    const years = await listFinancialYears(prisma, guard.context);
    return NextResponse.json({ financialYears: years });
  } catch (error) {
    return accountingErrorResponse(error, 'list financial years');
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '');
  const permission = {
    preview: [ACCOUNTING_PERMISSIONS.FY_VIEW, ACCOUNTING_PERMISSIONS.FY_CREATE, ACCOUNTING_PERMISSIONS.PERIODS_VIEW],
    create: [ACCOUNTING_PERMISSIONS.FY_CREATE],
    open: [ACCOUNTING_PERMISSIONS.FY_OPEN, ACCOUNTING_PERMISSIONS.FY_CREATE],
  }[action];
  if (!permission) {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
  const guard = await guardAccountingRoute(request, permission);
  if (guard.response) return guard.response;
  try {
    if (action === 'preview') {
      const preview = await previewFinancialYear(prisma, guard.context, { startYear: body.startYear });
      return NextResponse.json(preview);
    }
    if (action === 'create') {
      const created = await createFinancialYear(prisma, guard.context, { startYear: body.startYear });
      return NextResponse.json(created, { status: 201 });
    }
    const opened = await openFinancialYear(prisma, guard.context, String(body.financialYearId ?? ''));
    return NextResponse.json({ financialYear: opened });
  } catch (error) {
    return accountingErrorResponse(error, `financial year ${action}`);
  }
}
