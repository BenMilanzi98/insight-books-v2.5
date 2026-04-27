import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { fetchExpiryAlerts } from '@/lib/expiryAlertsService';

export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let branchId = searchParams.get('branchId') ?? null;
    if (!branchId) {
      branchId = user.currentBranchId ?? null;
      if (branchId && typeof branchId !== 'string') {
        branchId = branchId?.id ?? null;
      }
    }

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: user.tenantId },
      select: {
        expiryWarnDaysEarly: true,
        expiryWarnDaysUrgent: true,
      },
    });

    const earlyDays = settings?.expiryWarnDaysEarly ?? 30;
    const urgentDays = settings?.expiryWarnDaysUrgent ?? 7;

    const data = await fetchExpiryAlerts({
      tenantId: user.tenantId,
      branchId,
      earlyDays,
      urgentDays,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[expiry-alerts]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load expiry alerts' },
      { status: 500 }
    );
  }
}
