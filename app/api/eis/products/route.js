import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { hasEISAccess } from '@/lib/subscriptionService';
import eisService from '@/lib/eisService';

/** TC-INV-002: Get terminal site products from MRA */
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

    const result = await eisService.getTerminalSiteProducts(user.tenantId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Get site products error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Upload initial inventory to MRA */
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
    const { products, isLastBatch } = body;
    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'Products array is required' }, { status: 400 });
    }

    const result = await eisService.uploadInitialInventory(user.tenantId, products, isLastBatch !== false);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Inventory upload error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
