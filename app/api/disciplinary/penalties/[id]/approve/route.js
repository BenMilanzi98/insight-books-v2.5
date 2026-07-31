import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';

export async function POST(request, { params }) {
  try {
    const perm = await requireAnyPermission(request, ['hr.view', 'payroll.update']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { id } = await params;
    const penalty = await prisma.disciplinaryPenalty.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!penalty) {
      return NextResponse.json({ error: 'Penalty not found' }, { status: 404 });
    }
    const updated = await prisma.disciplinaryPenalty.update({
      where: { id: penalty.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: user.id,
      },
    });
    return NextResponse.json({ penalty: updated });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
