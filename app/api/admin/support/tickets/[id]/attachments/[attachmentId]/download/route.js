import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  getAttachmentDownload,
  sanitizeContentDispositionFileName,
} from '@/lib/admin/support';

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const result = await getAttachmentDownload(prisma, {
      admin,
      ticketId: params?.id,
      attachmentId: params?.attachmentId,
    });

    if (result.forbidden) {
      return NextResponse.json(
        {
          success: false,
          error: 'Attachment not downloadable',
          reason: result.reason,
          scanState: result.scanState,
        },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json({ success: false, error: 'Attachment not found' }, { status: 404 });
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to download attachment' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    const safeName = sanitizeContentDispositionFileName(result.fileName);
    const headers = new Headers();
    headers.set('Content-Type', result.mimeType || 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${safeName}"`);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Cache-Control', 'private, no-store');

    return new NextResponse(result.buffer, { status: 200, headers });
  } catch (error) {
    console.error('Support attachment download error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to download support attachment' },
      { status: 500 }
    );
  }
}
