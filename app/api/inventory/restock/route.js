import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { executeInventoryRestock } from '@/lib/inventoryWriteOffService';

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
    const {
      productId,
      quantity,
      unitCost,
      expiryDate,
      branchId,
      notes,
      priorBatchId,
    } = body || {};

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const result = await executeInventoryRestock(prisma, {
      tenantId: user.tenantId,
      userId: user.id,
      productId,
      quantity,
      unitCost,
      expiryDate,
      branchId,
      notes,
      priorBatchId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[inventory restock]', error);
    const msg = error?.message || 'Restock failed';
    let status = 500;
    if (msg.includes('not found') || msg.includes('Product not found')) status = 404;
    else if (
      msg.includes('must') ||
      msg.includes('cannot') ||
      msg.includes('Invalid') ||
      msg.includes('positive')
    ) {
      status = 400;
    }
    return NextResponse.json({ error: msg }, { status });
  }
}
