// app/api/expenses/[id]/attachments/route.js
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// POST - Upload attachment for an expense
export async function POST(request, { params }) {
  try {
    const { id: expenseId } = await params;
    if (!expenseId) {
      return NextResponse.json({ error: 'Expense id is required' }, { status: 400 });
    }
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Verify the expense exists and belongs to the user's tenant
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId }
    });
    
    if (!expense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }
    
    if (expense.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Process the form data
    const formData = await request.formData();
    const files = formData.getAll('file');
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      );
    }
    
    // Process each file
    const attachments = [];
    for (const file of files) {
      // Validate file type and size
      if (!file.type.match(/^image\/(jpeg|png|gif)$/) && !file.type.match(/^application\/pdf$/)) {
        continue; // Skip unsupported file types
      }
      
      // Size validation (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        continue; // Skip files that are too large
      }
      
      // Create a unique filename
      const fileExtension = file.name.split('.').pop();
      const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;
      
      // Define file path structure: /uploads/tenantId/expenses/expenseId/
      const uploadDir = join(process.cwd(), 'public', 'uploads', user.tenantId, 'expenses', expenseId);
      
      // Create directory if it doesn't exist
      await mkdir(uploadDir, { recursive: true });
      
      // Full path to file
      const filePath = join(uploadDir, uniqueFilename);
      
      // Write file to disk
      const fileBytes = await file.arrayBuffer();
      await writeFile(filePath, Buffer.from(fileBytes));
      
      // Public URL for the file
      const fileUrl = `/uploads/${user.tenantId}/expenses/${expenseId}/${uniqueFilename}`;
      
      // Create attachment record in database
      const attachment = await prisma.expenseAttachment.create({
        data: {
          expense: {
            connect: {
              id: expenseId
            }
          },
          filename: file.name,
          fileType: file.type,
          fileSize: file.size,
          filePath: fileUrl,
          uploadedBy: {
            connect: { id: user.id }
          }
        }
      });
      
      // Add to attachments array
      attachments.push({
        id: attachment.id,
        name: attachment.filename,
        type: attachment.fileType,
        size: formatFileSize(attachment.fileSize),
        url: attachment.filePath,
        date: attachment.uploadedAt.toISOString().split('T')[0]
      });
    }
    
    // Create an audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'EXPENSE_ATTACHMENTS_ADDED',
        entityType: 'EXPENSE',
        entityId: expenseId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          attachmentCount: attachments.length
        })
      }
    });
    
    // Return success with attachment info
    return NextResponse.json({
      message: 'Attachments uploaded successfully',
      attachments
    });
  } catch (error) {
    console.error(`Error uploading attachments:`, error);
    return NextResponse.json(
      { error: 'Failed to upload attachments. Please try again.' },
      { status: 500 }
    );
  }
}

// GET - List attachments for an expense
export async function GET(request, { params }) {
  try {
    const { id: expenseId } = await params;
    if (!expenseId) {
      return NextResponse.json({ error: 'Expense id is required' }, { status: 400 });
    }
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Verify the expense exists and belongs to the user's tenant
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        expenseAttachments: {
          select: {
            id: true,
            filename: true,
            fileType: true,
            fileSize: true,
            filePath: true,
            uploadedAt: true,
          },
          orderBy: {
            uploadedAt: 'desc'
          }
        }
      }
    });
    
    if (!expense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }
    
    if (expense.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Format attachments for response
    const attachments = expense.expenseAttachments.map(attachment => ({
      id: attachment.id,
      name: attachment.filename,
      type: attachment.fileType,
      size: formatFileSize(attachment.fileSize),
      url: attachment.filePath,
      date: attachment.uploadedAt.toISOString().split('T')[0]
    }));
    
    return NextResponse.json({ attachments });
  } catch (error) {
    console.error(`Error fetching attachments:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch attachments. Please try again.' },
      { status: 500 }
    );
  }
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
  return Math.round(bytes / 1048576 * 10) / 10 + ' MB';
}