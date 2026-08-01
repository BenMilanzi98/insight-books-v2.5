import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { getLeadSourceEvidence } from '@/lib/admin/marketing';

export async function GET(request, { params }) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId } = await params;
    const result = await getLeadSourceEvidence(prisma, { admin, leadId });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Lead not found' },
        { status: result.error === 'lead_not_found' ? 404 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Marketing lead source evidence error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load lead source evidence' },
      { status: 500 }
    );
  }
}
