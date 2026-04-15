import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { ownerUserId: true },
    });
    const isTenantOwner = tenant?.ownerUserId === user.id;

    if (!isTenantOwner) {
      return NextResponse.json({
        isTenantOwner: false,
        requiresCapital: false,
        requiresPayments: false,
      });
    }

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: user.tenantId },
      select: {
        capitalSetupCompletedAt: true,
        paymentAccountsSetupCompletedAt: true,
        ownerContributedCapital: true,
      },
    });

    // No settings row: legacy / pre-feature tenant — treat as fully onboarded (defaults).
    if (!settings) {
      return NextResponse.json({
        isTenantOwner: true,
        requiresCapital: false,
        requiresPayments: false,
        ownerContributedCapital: 0,
      });
    }

    const requiresCapital = !settings.capitalSetupCompletedAt;
    const requiresPayments =
      !!settings.capitalSetupCompletedAt && !settings.paymentAccountsSetupCompletedAt;

    return NextResponse.json({
      isTenantOwner: true,
      requiresCapital,
      requiresPayments,
      ownerContributedCapital: Number(settings.ownerContributedCapital) || 0,
    });
  } catch (e) {
    console.error('onboarding-status:', e);
    return NextResponse.json({ error: 'Failed to load onboarding status' }, { status: 500 });
  }
}
