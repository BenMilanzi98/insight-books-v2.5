import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { fetchExpiryAlerts } from '@/lib/expiryAlertsService';

function isMissingDbFieldError(error) {
  const msg = String(error?.message || '');
  return (
    error?.code === 'P2022' ||
    msg.includes('column') ||
    msg.includes('does not exist') ||
    msg.includes('Unknown field')
  );
}

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

    let settings = null;
    try {
      settings = await prisma.tenantSettings.findUnique({
        where: { tenantId: user.tenantId },
        select: {
          expiryWarnDaysEarly: true,
          expiryWarnDaysUrgent: true,
        },
      });
    } catch (settingsError) {
      // Backward compatibility when DB migration for threshold fields is not applied yet.
      if (!isMissingDbFieldError(settingsError)) throw settingsError;
    }

    const earlyDays = settings?.expiryWarnDaysEarly ?? 60;
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
