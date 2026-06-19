import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import {
  loadPayrollAccountMappings,
  resolvePayrollAccountMappings,
  validatePayrollAccountMappings,
  savePayrollAccountMappings,
  PAYROLL_MAPPING_KEYS,
} from '@/lib/payrollEngine/accountMappings';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, ['payroll.view', 'payroll.manage', 'accounting.view']);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const raw = await loadPayrollAccountMappings(user.tenantId);
    const resolved = await resolvePayrollAccountMappings(user.tenantId, raw);
    const validation = validatePayrollAccountMappings(resolved);

    const accountIds = [...new Set(Object.values(resolved).filter(Boolean))];
    const accounts = accountIds.length
      ? await prisma.account.findMany({
          where: { tenantId: user.tenantId, id: { in: accountIds } },
          select: { id: true, accountCode: true, name: true },
        })
      : [];

    const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]));

    return NextResponse.json({
      mappings: resolved,
      validation,
      keys: PAYROLL_MAPPING_KEYS,
      accounts: accountMap,
    });
  } catch (error) {
    console.error('account-mappings GET:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const perm = await requireAnyPermission(request, ['payroll.manage', 'accounting.manage', 'settings.manage']);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const saved = await savePayrollAccountMappings(user.tenantId, body.mappings || body);
    const resolved = await resolvePayrollAccountMappings(user.tenantId, saved);
    const validation = validatePayrollAccountMappings(resolved);

    return NextResponse.json({ mappings: resolved, validation });
  } catch (error) {
    console.error('account-mappings PUT:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
