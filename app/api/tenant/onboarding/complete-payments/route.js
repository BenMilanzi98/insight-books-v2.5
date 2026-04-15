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

    const activeCount = await prisma.paymentAccount.count({
      where: { tenantId: user.tenantId, isActive: true },
    });
    if (activeCount < 1) {
      return NextResponse.json(
        { error: 'Create at least one active payment account under Payment management before continuing.' },
        { status: 400 }
      );
    }

    await prisma.tenantSettings.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        enabledModules: [],
        paymentAccountsSetupCompletedAt: new Date(),
      },
      update: {
        paymentAccountsSetupCompletedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('complete-payments onboarding:', e);
    return NextResponse.json({ error: 'Failed to save setup' }, { status: 500 });
  }
}
