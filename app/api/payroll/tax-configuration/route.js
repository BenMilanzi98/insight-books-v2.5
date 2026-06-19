import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import {
  loadActivePayrollTaxConfiguration,
  ensureDefaultPayrollTaxConfiguration,
  normalizeTaxBands,
  DEFAULT_MALAWI_TAX_BANDS,
} from '@/lib/payrollEngine/taxConfiguration';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, ['payroll.view', 'payroll.manage', 'hr.view']);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const asOf = searchParams.get('asOf') || new Date().toISOString();

    const active = await loadActivePayrollTaxConfiguration(user.tenantId, asOf);

    let all = [];
    try {
      all = await prisma.payrollTaxConfiguration.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { effectiveFrom: 'desc' },
      });
    } catch (err) {
      if (!(err?.code === 'P2021' || /PayrollTaxConfiguration/.test(String(err?.message)))) {
        throw err;
      }
    }

    return NextResponse.json({ active, configurations: all });
  } catch (error) {
    console.error('tax-configuration GET:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const perm = await requireAnyPermission(request, ['payroll.manage', 'settings.manage']);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const bands = normalizeTaxBands(body.bands || DEFAULT_MALAWI_TAX_BANDS);
    const effectiveFrom = body.effectiveFrom ? new Date(body.effectiveFrom) : new Date();
    const effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null;

    if (body.deactivateOthers) {
      await prisma.payrollTaxConfiguration.updateMany({
        where: { tenantId: user.tenantId, isActive: true },
        data: { isActive: false },
      });
    }

    const row = await prisma.payrollTaxConfiguration.create({
      data: {
        tenantId: user.tenantId,
        country: body.country || 'MW',
        taxYear: body.taxYear || effectiveFrom.getFullYear(),
        effectiveFrom,
        effectiveTo,
        bands,
        monthlyTaxFreeAllowance: Number(body.monthlyTaxFreeAllowance) || 0,
        isActive: body.isActive !== false,
      },
    });

    return NextResponse.json({ configuration: row }, { status: 201 });
  } catch (error) {
    console.error('tax-configuration POST:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const perm = await requireAnyPermission(request, ['payroll.manage', 'settings.manage']);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.id) {
      const seeded = await ensureDefaultPayrollTaxConfiguration(user.tenantId);
      return NextResponse.json({ configuration: seeded, seeded: true });
    }

    const existing = await prisma.payrollTaxConfiguration.findFirst({
      where: { id: body.id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
    }

    const row = await prisma.payrollTaxConfiguration.update({
      where: { id: body.id },
      data: {
        country: body.country ?? existing.country,
        taxYear: body.taxYear ?? existing.taxYear,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : existing.effectiveFrom,
        effectiveTo: body.effectiveTo !== undefined
          ? (body.effectiveTo ? new Date(body.effectiveTo) : null)
          : existing.effectiveTo,
        bands: body.bands ? normalizeTaxBands(body.bands) : existing.bands,
        monthlyTaxFreeAllowance:
          body.monthlyTaxFreeAllowance != null
            ? Number(body.monthlyTaxFreeAllowance)
            : existing.monthlyTaxFreeAllowance,
        isActive: body.isActive ?? existing.isActive,
      },
    });

    return NextResponse.json({ configuration: row });
  } catch (error) {
    console.error('tax-configuration PUT:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
