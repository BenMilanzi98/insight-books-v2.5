// app/api/leave-requests/[id]/reject/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function POST(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'Rejected', rejectionReason: reason || null }
    });

    return NextResponse.json({ request: updated });
  } catch (e) {
    console.error('Leave request REJECT error:', e);
    return NextResponse.json({ error: 'Failed to reject leave request' }, { status: 500 });
  }
}



