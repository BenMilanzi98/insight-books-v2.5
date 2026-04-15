import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { ownerUserId: true },
    });
    if (tenant?.ownerUserId !== user.id) {
      return NextResponse.json({ error: 'Only the business owner can complete this step.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const opening = parseFloat(body.openingContributedAmount);

    const existing = await prisma.tenantSettings.findUnique({
      where: { tenantId: user.tenantId },
      select: { ownerContributedCapital: true },
    });
    const prev = Number(existing?.ownerContributedCapital) || 0;

    await prisma.tenantSettings.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        enabledModules: [],
        capitalSetupCompletedAt: new Date(),
        ownerContributedCapital:
          !Number.isNaN(opening) && opening > 0 && prev === 0 ? opening : prev,
      },
      update: {
        capitalSetupCompletedAt: new Date(),
        ...(!Number.isNaN(opening) && opening > 0 && prev === 0
          ? { ownerContributedCapital: opening }
          : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('complete-capital onboarding:', e);
    return NextResponse.json({ error: 'Failed to save setup' }, { status: 500 });
  }
}
