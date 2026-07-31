import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  approveDataPackVersion,
  createDataPackVersion,
  listDataPackVersions,
  requestDataPackApproval,
  updateDataPackVersion,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listDataPackVersions(prisma, {
      admin,
      code: searchParams.get('code') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || '50',
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM demo data packs list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list demo data packs' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'create').trim().toLowerCase();
    let result;

    if (action === 'update') {
      result = await updateDataPackVersion(prisma, {
        admin,
        dataPackId: body.dataPackId || body.id,
        patch: body.patch || body,
      });
    } else if (action === 'request-approval') {
      result = await requestDataPackApproval(prisma, {
        admin,
        dataPackId: body.dataPackId || body.id,
      });
    } else if (action === 'approve') {
      result = await approveDataPackVersion(prisma, {
        admin,
        dataPackId: body.dataPackId || body.id,
      });
    } else {
      result = await createDataPackVersion(prisma, {
        admin,
        code: body.code,
        name: body.name,
        sourceKind: body.sourceKind,
        payloadJson: body.payloadJson,
        version: body.version,
        productionTenantId: body.productionTenantId,
        tenantId: body.tenantId,
        isProduction: body.isProduction,
        containsCredentials: body.containsCredentials,
        isProductionData: body.isProductionData,
      });
    }

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: result.error || 'Not found' },
        { status: 404 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed data pack action', hits: result.hits },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM demo data packs action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed demo data pack action' },
      { status: 500 }
    );
  }
}
