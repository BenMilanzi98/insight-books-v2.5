import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { createEmailDraft, listEmailActivities } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listEmailActivities(prisma, {
      admin,
      subjectType: searchParams.get('subjectType') || undefined,
      subjectId: searchParams.get('subjectId') || undefined,
      status: searchParams.get('status') || undefined,
      activityId: searchParams.get('activityId') || undefined,
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list emails' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM emails list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM emails' },
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
    const result = await createEmailDraft(prisma, {
      admin,
      toAddress: body.toAddress || body.to,
      subject: body.subject,
      bodyHtml: body.bodyHtml || body.html,
      bodyText: body.bodyText || body.text,
      templateCode: body.templateCode,
      templateVersion: body.templateVersion,
      templateVars: body.templateVars,
      subjectType: body.subjectType || 'LEAD',
      subjectId: body.subjectId || body.leadId || body.opportunityId,
      contactId: body.contactId,
      purpose: body.purpose,
      ownerAdminId: body.ownerAdminId,
      idempotencyKey: body.idempotencyKey,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create email draft' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        email: result.email,
        activity: result.activity,
        alreadyExists: result.alreadyExists,
      },
      { status: result.alreadyExists ? 200 : 201 }
    );
  } catch (error) {
    console.error('CRM emails create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create CRM email draft' },
      { status: 500 }
    );
  }
}
