import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { parseMoney } from '@/lib/money';

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, ['payroll.view', 'hr.view']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const rules = await prisma.pensionRule.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { effectiveFrom: 'desc' },
    });
    return NextResponse.json({ rules });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const perm = await requireAnyPermission(request, ['payroll.update', 'hr.view']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    if (body.employeeRatePercent == null || body.employerRatePercent == null || !body.effectiveFrom) {
      return NextResponse.json(
        { error: 'employeeRatePercent, employerRatePercent, effectiveFrom required' },
        { status: 400 }
      );
    }
    const rule = await prisma.pensionRule.create({
      data: {
        tenantId: user.tenantId,
        name: body.name || 'NPS',
        employeeRatePercent: parseMoney(body.employeeRatePercent),
        employerRatePercent: parseMoney(body.employerRatePercent),
        effectiveFrom: new Date(body.effectiveFrom),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
        isActive: body.isActive !== false,
      },
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
