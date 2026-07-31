import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { getLatestLeadScore } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');
    const result = await getLatestLeadScore(prisma, { admin, leadId });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to load lead score' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      evaluation: result.evaluation,
      status: result.status,
      confidence: result.confidence,
      isProbability: false,
    });
  } catch (error) {
    console.error('CRM score latest error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load lead score' },
      { status: 500 }
    );
  }
}
