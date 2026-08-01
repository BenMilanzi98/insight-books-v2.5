import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { activateNormalisationRule } from '@/lib/admin/marketing';

export async function POST(request, { params }) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await activateNormalisationRule(prisma, { admin, id });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to activate rule' },
        { status: result.statusCode === 404 ? 404 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Marketing normalisation rule activate error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to activate normalisation rule' },
      { status: 500 }
    );
  }
}
