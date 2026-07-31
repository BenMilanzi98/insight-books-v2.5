import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  detectCalendarConflicts,
  exportIcs,
  getCalendarIntegrationStatus,
  listCalendarEvents,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = String(searchParams.get('mode') || 'list').trim().toLowerCase();

    if (mode === 'integrations' || mode === 'status') {
      return NextResponse.json({
        success: true,
        integrations: getCalendarIntegrationStatus(),
      });
    }

    if (mode === 'conflicts') {
      const result = await detectCalendarConflicts(prisma, {
        admin,
        ownerAdminId: searchParams.get('ownerAdminId') || admin.id,
        startsAt: searchParams.get('startsAt'),
        endsAt: searchParams.get('endsAt'),
        excludeMeetingId: searchParams.get('excludeMeetingId') || undefined,
      });
      if (result.forbidden) {
        return NextResponse.json(
          { success: false, error: 'Insufficient admin privileges' },
          { status: 403 }
        );
      }
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.error || 'Conflict detect failed' },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    if (mode === 'ics') {
      const eventIds = (searchParams.get('eventIds') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const result = await exportIcs(prisma, {
        admin,
        ownerAdminId: searchParams.get('ownerAdminId') || admin.id,
        eventIds,
      });
      if (result.forbidden) {
        return NextResponse.json(
          { success: false, error: 'Insufficient admin privileges' },
          { status: 403 }
        );
      }
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.error || 'ICS export failed' },
          { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
        );
      }
      return new NextResponse(result.ics, {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="crm-calendar.ics"',
          'X-CRM-External-Sync': 'false',
        },
      });
    }

    const result = await listCalendarEvents(prisma, {
      admin,
      view: searchParams.get('view') || 'day',
      date: searchParams.get('date') || undefined,
      timezone: searchParams.get('timezone') || 'UTC',
      ownerAdminId: searchParams.get('ownerAdminId') || undefined,
      availabilityOnly: searchParams.get('availabilityOnly') === 'true',
      includeCancelled: searchParams.get('includeCancelled') === 'true',
      limit: searchParams.get('limit') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list calendar events' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM calendar list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load CRM calendar' },
      { status: 500 }
    );
  }
}
