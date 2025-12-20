// app/api/expenses/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// Helper function to get expense by ID with validation
async function getExpenseWithValidation(id, userId, tenantId) {
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      submittedBy: {
        select: {
          id: true,
          name: true,
        }
      },
      expenseAttachments: {
        select: {
          id: true,
          filename: true,
          fileType: true,
          fileSize: true,
          uploadedAt: true,
        }
      }
    }
  });
  
  if (!expense) {
    return { error: 'Expense not found', status: 404 };
  }
  
  // Security check: Ensure the expense belongs to the user's tenant
  if (expense.tenantId !== tenantId) {
    return { error: 'Access denied', status: 403 };
  }
  
  return {
    expense: {
      ...expense,
      // Format the amount for display
      amount: expense.amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      // Format the date for display
      date: expense.date.toISOString().split('T')[0],
      // Map attachments to the expected format
      attachments: expense.expenseAttachments.map(attachment => ({
        id: attachment.id,
        name: attachment.filename,
        type: attachment.fileType,
        size: formatFileSize(attachment.fileSize),
        date: attachment.uploadedAt.toISOString().split('T')[0]
      }))
    }
  };
}

// GET - Fetch a single expense by ID
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const expenseId = id;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get expense with validation
    const result = await getExpenseWithValidation(expenseId, user.id, user.tenantId);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    
    return NextResponse.json(result.expense);
  } catch (error) {
    console.error(`Error fetching expense ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch expense. Please try again.' },
      { status: 500 }
    );
  }
}

// PUT - Update an expense
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const expenseId = id;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get expense with validation
    const result = await getExpenseWithValidation(expenseId, user.id, user.tenantId);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    
    const body = await request.json();
    
    // Parse amount - convert string to number if needed
    let amount = body.amount;
    if (typeof body.amount === 'string') {
      amount = parseFloat(body.amount.replace(/,/g, ''));
    }
    
    // Prepare update data
    const updateData = {};
    
    // Only include fields that are provided in the request
    if (body.description !== undefined) updateData.description = body.description;
    if (amount !== undefined) updateData.amount = amount;
    if (body.date !== undefined) updateData.date = new Date(body.date);
    if (body.category !== undefined) updateData.category = body.category;
    if (body.merchant !== undefined) updateData.merchant = body.merchant;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;
    // Payment status fields
    if (body.paymentStatus !== undefined) updateData.paymentStatus = body.paymentStatus;
    if (body.paidAmount !== undefined) updateData.paidAmount = body.paidAmount;
    if (body.paymentReference !== undefined) updateData.paymentReference = body.paymentReference;
    
    // Update the expense
    const updatedExpense = await prisma.expense.update({
      where: { id: expenseId },
      data: updateData,
      include: {
        expenseAttachments: true
      }
    });
    
    // Create an audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'EXPENSE_UPDATED',
        entityType: 'EXPENSE',
        entityId: updatedExpense.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify(updateData)
      }
    });
    
    // Return updated expense
    return NextResponse.json({
      message: 'Expense updated successfully',
      expense: {
        ...updatedExpense,
        // Format the amount for display
        amount: updatedExpense.amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        // Format the date for display
        date: updatedExpense.date.toISOString().split('T')[0],
        // Map attachments to the expected format
        attachments: updatedExpense.expenseAttachments.map(attachment => ({
          id: attachment.id,
          name: attachment.filename,
          type: attachment.fileType,
          size: formatFileSize(attachment.fileSize),
          date: attachment.uploadedAt.toISOString().split('T')[0]
        }))
      }
    });
  } catch (error) {
    console.error(`Error updating expense ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to update expense. Please try again.' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an expense
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const expenseId = id;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get expense with validation
    const result = await getExpenseWithValidation(expenseId, user.id, user.tenantId);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    
    // Parse deletion reason from request body if provided
    const body = await request.json().catch(() => ({}));
    const deletionReason = body.reason || 'Manual deletion';
    
    // Soft delete the expense (mark as deleted instead of hard delete)
    await prisma.$transaction(async (tx) => {
      // Soft delete the expense
      await tx.expense.update({
        where: { id: expenseId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedById: user.id,
          deletionReason: deletionReason
        }
      });
      
      // Create an audit log entry
      await tx.auditLog.create({
        data: {
          action: 'EXPENSE_SOFT_DELETED',
          entityType: 'EXPENSE',
          entityId: expenseId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            description: result.expense.description,
            amount: result.expense.amount,
            category: result.expense.category,
            status: result.expense.status,
            deletionReason: deletionReason,
            canRestore: true
          })
        }
      });
    });
    
    return NextResponse.json({
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting expense ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to delete expense. Please try again.' },
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