import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { tenantId } = body;
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await prisma.tenant.delete({
      where: { id: tenantId }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
