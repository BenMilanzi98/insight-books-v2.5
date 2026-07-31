import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { getPipeline } from '@/lib/admin/crm';

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const id = params?.id;
    const result = await getPipeline(prisma, { admin, id });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: 'Pipeline not found' },
        { status: 404 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to get pipeline' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, pipeline: result.pipeline });
  } catch (error) {
    console.error('CRM pipeline get error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get CRM pipeline' },
      { status: 500 }
    );
  }
}
