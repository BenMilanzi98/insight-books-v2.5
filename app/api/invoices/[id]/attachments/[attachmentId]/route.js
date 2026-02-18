// app/api/invoices/[id]/attachments/[attachmentId]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { unlink } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

/**
 * GET - Download an attachment
 */
export async function GET(request, context) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: invoiceId, attachmentId } = await context.params;

    // Verify attachment belongs to invoice and tenant
    const attachment = await prisma.invoiceAttachment.findFirst({
      where: {
        id: attachmentId,
        invoiceId,
        tenantId: user.tenantId
      }
    });

    if (!attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Get file path
    const filePath = path.join(process.cwd(), attachment.filePath);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Read file
    const fs = await import('fs');
    const fileBuffer = fs.readFileSync(filePath);

    // Return file
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `attachment; filename="${attachment.fileName}"`,
        'Content-Length': attachment.fileSize.toString()
      }
    });
  } catch (error) {
    console.error('Error downloading invoice attachment:', error);
    return NextResponse.json(
      { error: 'Failed to download attachment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete an attachment
 */
export async function DELETE(request, context) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: invoiceId, attachmentId } = await context.params;

    // Verify attachment belongs to invoice and tenant
    const attachment = await prisma.invoiceAttachment.findFirst({
      where: {
        id: attachmentId,
        invoiceId,
        tenantId: user.tenantId
      }
    });

    if (!attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Delete file from filesystem
    const filePath = path.join(process.cwd(), attachment.filePath);
    if (existsSync(filePath)) {
      await unlink(filePath);
    }

    // Delete attachment record
    await prisma.invoiceAttachment.delete({
      where: {
        id: attachmentId
      }
    });

    return NextResponse.json({
      message: 'Attachment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting invoice attachment:', error);
    return NextResponse.json(
      { error: 'Failed to delete attachment' },
      { status: 500 }
    );
  }
}
