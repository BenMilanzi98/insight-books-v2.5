import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  listReminders,
  scheduleReminder,
  queueDueReminders,
  markReminderDelivered,
  snoozeReminder,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listReminders(prisma, {
      admin,
      activityId: searchParams.get('activityId') || undefined,
      recipientAdminId: searchParams.get('recipientAdminId') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || '50',
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM reminders list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list reminders' },
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
    const action = String(body.action || 'schedule').trim().toLowerCase();

    if (action === 'queue') {
      const result = await queueDueReminders(prisma, { admin, limit: body.limit });
      if (result.forbidden) {
        return NextResponse.json(
          { success: false, error: 'Insufficient admin privileges', reason: result.reason },
          { status: 403 }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'deliver') {
      const result = await markReminderDelivered(prisma, {
        admin,
        reminderId: body.reminderId || body.id,
      });
      if (result.forbidden) {
        return NextResponse.json(
          { success: false, error: 'Insufficient admin privileges', reason: result.reason },
          { status: 403 }
        );
      }
      if (result.notFound) {
        return NextResponse.json({ success: false, error: result.error }, { status: 404 });
      }
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.error || 'deliver_failed', ...result },
          { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'snooze') {
      const result = await snoozeReminder(prisma, {
        admin,
        reminderId: body.reminderId || body.id,
        snoozeUntil: body.snoozeUntil,
      });
      if (result.forbidden) {
        return NextResponse.json(
          { success: false, error: 'Insufficient admin privileges', reason: result.reason },
          { status: 403 }
        );
      }
      if (result.notFound) {
        return NextResponse.json({ success: false, error: result.error }, { status: 404 });
      }
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.error || 'snooze_failed', ...result },
          { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    const result = await scheduleReminder(prisma, {
      admin,
      ruleKey: body.ruleKey,
      activityId: body.activityId,
      recipientAdminId: body.recipientAdminId,
      occurrenceKey: body.occurrenceKey,
      channel: body.channel,
      dueAt: body.dueAt,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'schedule_failed', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM reminders mutate error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mutate reminder' },
      { status: 500 }
    );
  }
}
