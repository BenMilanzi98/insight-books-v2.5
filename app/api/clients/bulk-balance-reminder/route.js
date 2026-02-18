// app/api/clients/bulk-balance-reminder/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sendBalanceRemindersToClients } from '@/lib/balanceReminderService';

/**
 * POST - Send balance (payment) reminders to multiple clients at once
 * Body: { clientIds: string[] }
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const clientIds = Array.isArray(body.clientIds) ? body.clientIds : [];

    if (clientIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one client must be selected' },
        { status: 400 }
      );
    }

    // Ensure all clients belong to tenant
    const validClients = await prisma.client.findMany({
      where: {
        id: { in: clientIds },
        tenantId: user.tenantId
      },
      select: { id: true }
    });
    const validIds = validClients.map(c => c.id);

    const results = await sendBalanceRemindersToClients(validIds, user.tenantId, user.id);

    const sent = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return NextResponse.json({
      message: `Reminders sent to ${sent.length} of ${validIds.length} client(s)`,
      total: validIds.length,
      sent: sent.length,
      failed: failed.length,
      results: results.map(r => ({
        clientId: r.clientId,
        success: r.success,
        message: r.message || r.error
      }))
    });
  } catch (error) {
    console.error('Bulk balance reminder error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send reminders' },
      { status: 500 }
    );
  }
}
