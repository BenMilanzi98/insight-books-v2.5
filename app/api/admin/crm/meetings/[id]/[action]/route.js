import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  cancelMeeting,
  recordAttendance,
  recordMeetingRsvp,
  rescheduleMeeting,
} from '@/lib/admin/crm';

export async function POST(request, { params }) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, action } = await params;
    const meetingId = String(id || '').trim();
    const act = String(action || '').trim().toLowerCase();
    const body = await request.json().catch(() => ({}));

    let result;
    if (act === 'reschedule') {
      result = await rescheduleMeeting(prisma, {
        admin,
        meetingId,
        timezone: body.timezone,
        startsAt: body.startsAt || body.startsAtUtc,
        endsAt: body.endsAt || body.endsAtUtc,
        startsAtOriginal: body.startsAtOriginal,
        endsAtOriginal: body.endsAtOriginal,
        reason: body.reason,
        conflictPolicy: body.conflictPolicy,
        conflictReason: body.conflictReason,
      });
    } else if (act === 'cancel') {
      result = await cancelMeeting(prisma, {
        admin,
        meetingId,
        reason: body.reason,
        outcome: body.outcome,
        createFollowUp: body.createFollowUp === true,
      });
    } else if (act === 'rsvp') {
      result = await recordMeetingRsvp(prisma, {
        admin,
        meetingId,
        participantId: body.participantId,
        rsvpStatus: body.rsvpStatus,
      });
    } else if (act === 'attendance') {
      result = await recordAttendance(prisma, {
        admin,
        meetingId,
        participantId: body.participantId,
        attendanceStatus: body.attendanceStatus,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'invalid_action', action: act },
        { status: 400 }
      );
    }

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
          error: result.error || 'Meeting action failed',
          conflicts: result.conflicts,
        },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM meeting action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update CRM meeting' },
      { status: 500 }
    );
  }
}
