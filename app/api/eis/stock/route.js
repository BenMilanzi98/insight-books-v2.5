import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { hasEISAccess } from '@/lib/subscriptionService';
import eisService from '@/lib/eisService';

/** Get warehouse inventory from MRA */
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const hasEIS = await hasEISAccess(user.tenantId);
    if (!hasEIS) {
      return NextResponse.json({ error: 'EIS subscription required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const pageSize = parseInt(searchParams.get('pageSize')) || 50;

    const result = await eisService.getWarehouseInventory(user.tenantId, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Warehouse inventory error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Submit stock adjustment to MRA */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const hasEIS = await hasEISAccess(user.tenantId);
    if (!hasEIS) {
      return NextResponse.json({ error: 'EIS subscription required' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    let result;
    if (action === 'transfer') {
      result = await eisService.transferInventory(user.tenantId, body.data);
    } else if (action === 'informal-purchase') {
      result = await eisService.submitInformalPurchase(user.tenantId, body.data);
    } else if (action === 'adjustment-reasons') {
      result = await eisService.getStockAdjustmentReasons(user.tenantId);
    } else {
      result = await eisService.submitStockAdjustment(user.tenantId, body.data || body);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Stock operation error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
