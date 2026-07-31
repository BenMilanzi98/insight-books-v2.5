import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { getPipelineBoard } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await getPipelineBoard(prisma, {
      admin,
      myPipeline: searchParams.get('myPipeline') === '1' || searchParams.get('myPipeline') === 'true',
      ownerAdminId: searchParams.get('ownerAdminId') || undefined,
      columnLimit: searchParams.get('columnLimit') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (!result.ok && result.status === 'UNAVAILABLE') {
      return NextResponse.json(
        { success: false, error: result.error, columns: [] },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM pipeline board error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load pipeline board' },
      { status: 500 }
    );
  }
}
