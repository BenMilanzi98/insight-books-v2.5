// app/api/expenses/[id]/attachments/[attachmentId]/route.js
import { NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { join } from 'path';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// DELETE - Delete an attachment
export async function DELETE(request, { params }) {
  try {
    const { id: expenseId, attachmentId } = await params;
    if (!expenseId || !attachmentId) {
      return NextResponse.json(
        { error: 'Expense id and attachment id are required' },
        { status: 400 }
      );
    }
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Find the attachment and expense in a single query
    const attachment = await prisma.expenseAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        expense: {
          select: {
            tenantId: true
          }
        }
      }
    });
    
    if (!attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }
    
    // Security check: Verify the attachment belongs to an expense in the user's tenant
    if (attachment.expense.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Additional security check: Verify the attachment belongs to the specified expense
    if (attachment.expenseId !== expenseId) {
      return NextResponse.json(
        { error: 'Attachment does not belong to this expense' },
        { status: 400 }
      );
    }
    
    try {
      // Get the file path from the URL
      const filePath = join(
        process.cwd(),
        'public',
        attachment.filePath.replace(/^\//, '') // Remove leading slash
      );
      
      // Delete the file
      await unlink(filePath);
    } catch (fileError) {
      // Log error but continue (file might not exist or be accessible)
      console.error('Error deleting file:', fileError);
    }
    
    // Delete the attachment record
    await prisma.expenseAttachment.delete({
      where: { id: attachmentId }
    });
    
    // Create an audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'EXPENSE_ATTACHMENT_DELETED',
        entityType: 'EXPENSE_ATTACHMENT',
        entityId: attachmentId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          expenseId,
          filename: attachment.filename
        })
      }
    });
    
    return NextResponse.json({
      message: 'Attachment deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting attachment:`, error);
    return NextResponse.json(
      { error: 'Failed to delete attachment. Please try again.' },
      { status: 500 }
    );
  }
}