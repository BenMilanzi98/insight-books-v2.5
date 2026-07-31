import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listTimeline } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listTimeline(prisma, {
      admin,
      subjectType: searchParams.get('subjectType') || 'LEAD',
      subjectId: searchParams.get('subjectId') || searchParams.get('leadId') || '',
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || undefined,
      cursor: searchParams.get('cursor') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list timeline' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM timeline list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM timeline' },
      { status: 500 }
    );
  }
}
