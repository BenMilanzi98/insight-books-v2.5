import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { createMeeting, listMeetings } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listMeetings(prisma, {
      admin,
      subjectType: searchParams.get('subjectType') || undefined,
      subjectId: searchParams.get('subjectId') || undefined,
      status: searchParams.get('status') || undefined,
      ownerAdminId: searchParams.get('ownerAdminId') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list meetings' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM meetings list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM meetings' },
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
    const result = await createMeeting(prisma, {
      admin,
      title: body.title,
      subjectType: body.subjectType || 'LEAD',
      subjectId: body.subjectId || body.leadId || body.opportunityId,
      contactId: body.contactId,
      purpose: body.purpose,
      timezone: body.timezone,
      startsAt: body.startsAt || body.startsAtUtc,
      endsAt: body.endsAt || body.endsAtUtc,
      startsAtOriginal: body.startsAtOriginal,
      endsAtOriginal: body.endsAtOriginal,
      location: body.location,
      notes: body.notes,
      visibility: body.visibility,
      participants: body.participants,
      sendInvitations: body.sendInvitations === true,
      conflictPolicy: body.conflictPolicy,
      conflictReason: body.conflictReason,
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
        {
          success: false,
          error: result.error || 'Failed to create meeting',
          conflicts: result.conflicts,
        },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        meeting: result.meeting,
        activity: result.activity,
        calendarEvent: result.calendarEvent,
        participants: result.participants,
        conflicts: result.conflicts,
        integrations: result.integrations,
        alreadyExists: result.alreadyExists,
      },
      { status: result.alreadyExists ? 200 : 201 }
    );
  } catch (error) {
    console.error('CRM meetings create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create CRM meeting' },
      { status: 500 }
    );
  }
}
