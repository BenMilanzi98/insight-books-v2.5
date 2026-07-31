import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  listMessages,
  addPublicReply,
  addInternalNote,
  addRestrictedNote,
  SUPPORT_MESSAGE_TYPE,
} from '@/lib/admin/support';

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const result = await listMessages(prisma, { admin, ticketId: params?.id });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list messages' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, items: result.items, meta: result.meta });
  } catch (error) {
    console.error('Support messages list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list support messages' },
      { status: 500 }
    );
  }
}

export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json().catch(() => ({}));
    const type = String(body.type || SUPPORT_MESSAGE_TYPE.PUBLIC_AGENT_REPLY)
      .trim()
      .toUpperCase();
    const text = body.body;

    let result;
    if (type === SUPPORT_MESSAGE_TYPE.INTERNAL_NOTE) {
      result = await addInternalNote(prisma, {
        admin,
        ticketId: params?.id,
        body: text,
      });
    } else if (type === SUPPORT_MESSAGE_TYPE.RESTRICTED_INTERNAL_NOTE) {
      result = await addRestrictedNote(prisma, {
        admin,
        ticketId: params?.id,
        body: text,
      });
    } else if (type === SUPPORT_MESSAGE_TYPE.PUBLIC_AGENT_REPLY) {
      result = await addPublicReply(prisma, {
        admin,
        ticketId: params?.id,
        body: text,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'invalid_message_type', type },
        { status: 400 }
      );
    }

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create message', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, message: result.message }, { status: 201 });
  } catch (error) {
    console.error('Support messages create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create support message' },
      { status: 500 }
    );
  }
}
