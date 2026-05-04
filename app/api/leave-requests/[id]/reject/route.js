// app/api/leave-requests/[id]/reject/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { isLeaveStatus, normalizeLeaveStatus } from '@/lib/hrCalculations';

export async function POST(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    const existing = await prisma.leaveRequest.findFirst({
      where: { id, tenantId: user.tenantId }
    });
    if (!existing) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }
    if (!isLeaveStatus(existing.status, 'pending')) {
      return NextResponse.json({ error: 'Only pending leave requests can be rejected' }, { status: 400 });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: normalizeLeaveStatus('rejected'),
        reviewedAt: new Date(),
        reviewedBy: user.id,
        reviewComments: reason || null
      }
    });

    return NextResponse.json({ request: updated });
  } catch (e) {
    console.error('Leave request REJECT error:', e);
    return NextResponse.json({ error: 'Failed to reject leave request' }, { status: 500 });
  }
}



