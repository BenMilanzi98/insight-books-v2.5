import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { evaluateEmailSendEligibility } from '@/lib/admin/crm';

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await evaluateEmailSendEligibility(prisma, {
      contactId: body.contactId,
      purpose: body.purpose,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM email eligibility error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to evaluate email eligibility' },
      { status: 500 }
    );
  }
}
