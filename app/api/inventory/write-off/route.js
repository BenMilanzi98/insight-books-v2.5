import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { executeInventoryWriteOff } from '@/lib/inventoryWriteOffService';

export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { batchId, quantity, notes } = body || {};
    if (!batchId || typeof batchId !== 'string') {
      return NextResponse.json({ error: 'batchId is required' }, { status: 400 });
    }

    const result = await executeInventoryWriteOff(prisma, {
      tenantId: user.tenantId,
      userId: user.id,
      batchId,
      quantity,
      notes,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[inventory write-off]', error);
    const msg = error?.message || 'Write-off failed';
    let status = 500;
    if (msg.includes('not found') || msg.includes('Batch not found')) status = 404;
    else if (
      msg.includes('Nothing to write off') ||
      msg.includes('exceeds') ||
      msg.includes('Invalid')
    ) {
      status = 400;
    }
    return NextResponse.json({ error: msg }, { status });
  }
}
