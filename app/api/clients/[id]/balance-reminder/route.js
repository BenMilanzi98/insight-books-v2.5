// app/api/clients/[id]/balance-reminder/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { sendBalanceReminder } from '@/lib/balanceReminderService';

export async function POST(request, context) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: clientId } = await context.params;

    // Verify client belongs to tenant
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        tenantId: user.tenantId
      }
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Send balance reminder
    const result = await sendBalanceReminder(clientId, user.tenantId, {
      userId: user.id
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || 'Failed to send balance reminder' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: result.message,
      results: result.results
    });
  } catch (error) {
    console.error('Error sending balance reminder:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send balance reminder' },
      { status: 500 }
    );
  }
}
