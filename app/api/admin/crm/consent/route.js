import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { recordConsent, setDoNotContact } from '@/lib/admin/crm';

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const kind = String(body.kind || 'CONSENT').trim().toUpperCase();

    let result;
    if (kind === 'DNC') {
      result = await setDoNotContact(prisma, {
        admin,
        contactId: body.contactId,
        flag: body.flag,
        reason: body.reason || null,
        source: body.source,
        active: body.active !== false,
      });
    } else {
      result = await recordConsent(prisma, {
        admin,
        contactId: body.contactId,
        purpose: body.purpose,
        status: body.status,
        source: body.source,
        evidence: body.evidence || null,
        channel: body.channel || null,
      });
    }

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Consent update failed', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error('CRM consent error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update consent' },
      { status: 500 }
    );
  }
}
