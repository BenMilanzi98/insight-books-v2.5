import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  assignLead,
  acceptLeadAssignment,
  returnLeadToQueue,
} from '@/lib/admin/crm';

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'ASSIGN').trim().toUpperCase();

    let result;
    if (action === 'ACCEPT') {
      result = await acceptLeadAssignment(prisma, {
        admin,
        leadId: body.leadId,
        reason: body.reason || null,
      });
    } else if (action === 'REJECT' || action === 'RETURN_TO_QUEUE') {
      result = await returnLeadToQueue(prisma, {
        admin,
        leadId: body.leadId,
        action,
        reason: body.reason || null,
      });
    } else {
      result = await assignLead(prisma, {
        admin,
        leadId: body.leadId,
        strategy: body.strategy || 'MANUAL',
        ownerAdminId: body.ownerAdminId || null,
        teamId: body.teamId || null,
        memberAdminIds: body.memberAdminIds || [],
        territoryContext: body.territoryContext || {},
        reason: body.reason || null,
      });
    }

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
        { success: false, error: result.error || 'Assignment failed', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM assign error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to assign CRM lead' },
      { status: 500 }
    );
  }
}
