import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listAttachments, createAttachment } from '@/lib/admin/support';

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const result = await listAttachments(prisma, { admin, ticketId: params?.id });

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
        { success: false, error: result.error || 'Failed to list attachments' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, items: result.items, meta: result.meta });
  } catch (error) {
    console.error('Support attachments list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list support attachments' },
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
    const contentType = request.headers.get('content-type') || '';

    let fileName;
    let mimeType;
    let sizeBytes;
    let content;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      fileName = String(form.get('fileName') || file?.name || '').trim();
      mimeType = String(form.get('mimeType') || file?.type || '').trim();
      if (file && typeof file.arrayBuffer === 'function') {
        const buf = Buffer.from(await file.arrayBuffer());
        content = buf;
        sizeBytes = buf.length;
        if (!mimeType) mimeType = file.type || '';
        if (!fileName) fileName = file.name || 'upload';
      }
    } else {
      const body = await request.json().catch(() => ({}));
      fileName = body.fileName;
      mimeType = body.mimeType;
      sizeBytes = body.sizeBytes;
      if (body.contentBase64) {
        content = Buffer.from(String(body.contentBase64), 'base64');
        if (!sizeBytes) sizeBytes = content.length;
      } else if (body.content != null) {
        content = Buffer.from(String(body.content));
        if (!sizeBytes) sizeBytes = content.length;
      }
    }

    const result = await createAttachment(prisma, {
      admin,
      ticketId: params?.id,
      fileName,
      mimeType,
      sizeBytes,
      content,
    });

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
        { success: false, error: result.error || 'Failed to create attachment', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json(
      { success: true, attachment: result.attachment },
      { status: 201 }
    );
  } catch (error) {
    console.error('Support attachments create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create support attachment' },
      { status: 500 }
    );
  }
}
