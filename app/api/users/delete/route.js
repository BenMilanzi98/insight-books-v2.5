// app/api/users/delete/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// DELETE - Delete a user
export async function DELETE(request) {
  try {
    // Get authenticated user
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if user exists and belongs to the tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: user.tenantId // Ensure tenant isolation
      }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent self-deletion
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Check for related records that would prevent deletion
    const relatedRecords = await checkRelatedRecords(userId);
    
    if (relatedRecords.length > 0) {
      // Offer soft delete as an alternative
      return NextResponse.json(
        { 
          error: 'Cannot delete user due to related records',
          details: `User has ${relatedRecords.length} related records that must be handled first`,
          relatedRecords: relatedRecords,
          suggestion: 'Consider deactivating the user instead of deleting them',
          canSoftDelete: true
        },
        { status: 400 }
      );
    }

    // Delete the user
    await prisma.user.delete({
      where: { id: userId }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'USER_DELETED',
        entityType: 'USER',
        entityId: userId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          deletedUser: existingUser.email,
          deletedBy: user.email
        })
      }
    });

    return NextResponse.json({
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    
    // Check if it's a foreign key constraint error
    if (error.code === 'P2003') {
      return NextResponse.json(
        { 
          error: 'Cannot delete user due to related records in the system',
          details: 'This user has associated data that must be removed first (invoices, sales, expenses, etc.)'
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete user. Please try again.' },
      { status: 500 }
    );
  }
}

// Helper function to check for related records
async function checkRelatedRecords(userId) {
  const relatedRecords = [];
  
  try {
    // Check AuditLogs
    const auditLogs = await prisma.auditLog.count({
      where: { userId }
    });
    if (auditLogs > 0) {
      relatedRecords.push({ table: 'AuditLogs', count: auditLogs });
    }

    // Check Invoices
    const invoices = await prisma.invoice.count({
      where: { createdById: userId }
    });
    if (invoices > 0) {
      relatedRecords.push({ table: 'Invoices', count: invoices });
    }

    // Check Sales
    const sales = await prisma.sale.count({
      where: { 
        OR: [
          { createdById: userId },
          { refundedById: userId },
          { voidedById: userId }
        ]
      }
    });
    if (sales > 0) {
      relatedRecords.push({ table: 'Sales', count: sales });
    }

    // Check Expenses
    const expenses = await prisma.expense.count({
      where: { submittedById: userId }
    });
    if (expenses > 0) {
      relatedRecords.push({ table: 'Expenses', count: expenses });
    }

    // Check Inventory Transactions
    const inventoryTransactions = await prisma.inventoryTransaction.count({
      where: { userId }
    });
    if (inventoryTransactions > 0) {
      relatedRecords.push({ table: 'InventoryTransactions', count: inventoryTransactions });
    }

    // Check Quotations
    const quotations = await prisma.quotation.count({
      where: { createdById: userId }
    });
    if (quotations > 0) {
      relatedRecords.push({ table: 'Quotations', count: quotations });
    }

    // Check Recurring Expenses
    const recurringExpenses = await prisma.recurringExpense.count({
      where: { createdById: userId }
    });
    if (recurringExpenses > 0) {
      relatedRecords.push({ table: 'RecurringExpenses', count: recurringExpenses });
    }

  } catch (error) {
    console.error('Error checking related records:', error);
  }
  
  return relatedRecords;
} 