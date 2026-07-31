import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { checkCommunicationEligibility, resolveCrmAccess } from '@/lib/admin/crm';

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const access = resolveCrmAccess(admin);
    if (!access.canViewContacts && !access.canManageConsent && !access.canViewLeads) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const result = await checkCommunicationEligibility(prisma, {
      contactId: body.contactId,
      purpose: body.purpose,
      channel: body.channel,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: 'Eligibility check failed', ...result },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM eligibility error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check eligibility' },
      { status: 500 }
    );
  }
}
