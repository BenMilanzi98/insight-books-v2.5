import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    console.log('Delete user endpoint called');
    const body = await request.json();
    console.log('Request body:', body);
    const { userId } = body;
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const admin = await getAdminFromRequest(request);
    if (!admin) {
      console.log('Admin authentication failed');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('Admin authenticated:', admin.email);
    console.log('Attempting to delete user with ID:', userId);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: {
          select: { id: true, name: true }
        },
        role: {
          select: { id: true, name: true }
        }
      }
    });

    if (!existingUser) {
      console.log('User not found:', userId);
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    console.log('User found, proceeding with deletion');

    // Use a transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      try {
        // Create admin audit log for user deletion
        await tx.adminAuditLog.create({
          data: {
            adminId: admin.id,
            action: 'USER_DELETE',
            entityType: 'USER',
            entityId: userId,
            details: `Deleted user: ${existingUser.name} (${existingUser.email}) from tenant: ${existingUser.tenant?.name || 'Unknown'}`,
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
            timestamp: new Date()
          }
        });

        console.log('Admin audit log created, proceeding with deletion');
        
        // Handle foreign key constraints by deleting related records first
        // Delete user audit logs
        const auditLogsDeleted = await tx.auditLog.deleteMany({
          where: { userId: userId }
        });
        console.log(`Deleted ${auditLogsDeleted.count} user audit logs`);
        
        // Delete user-related records from other tables
        // Delete expenses submitted by the user
        const expensesDeleted = await tx.expense.deleteMany({
          where: { submittedById: userId }
        });
        console.log(`Deleted ${expensesDeleted.count} expenses`);
        
        // Delete expense attachments uploaded by the user
        const attachmentsDeleted = await tx.expenseAttachment.deleteMany({
          where: { uploadedById: userId }
        });
        console.log(`Deleted ${attachmentsDeleted.count} expense attachments`);
        
        // Delete inventory transactions created by the user
        const inventoryTransactionsDeleted = await tx.inventoryTransaction.deleteMany({
          where: { userId: userId }
        });
        console.log(`Deleted ${inventoryTransactionsDeleted.count} inventory transactions`);
        
        // Delete invoices created by the user
        const invoicesDeleted = await tx.invoice.deleteMany({
          where: { createdById: userId }
        });
        console.log(`Deleted ${invoicesDeleted.count} invoices`);
        
        // Delete quotations created by the user
        const quotationsDeleted = await tx.quotation.deleteMany({
          where: { createdById: userId }
        });
        console.log(`Deleted ${quotationsDeleted.count} quotations`);
        
        // Delete recurring expenses created by the user
        const recurringExpensesDeleted = await tx.recurringExpense.deleteMany({
          where: { createdById: userId }
        });
        console.log(`Deleted ${recurringExpensesDeleted.count} recurring expenses`);
        
        // Delete sales created by the user
        const salesDeleted = await tx.sale.deleteMany({
          where: { createdById: userId }
        });
        console.log(`Deleted ${salesDeleted.count} sales`);
        
        // Delete affiliate referrals by the user
        const affiliateReferralsDeleted = await tx.affiliateReferral.deleteMany({
          where: { userId: userId }
        });
        console.log(`Deleted ${affiliateReferralsDeleted.count} affiliate referrals`);
        
        console.log('All user-related records deleted successfully');
        
        // Now delete the user
        await tx.user.delete({
          where: { id: userId }
        });
        
        console.log('User deleted successfully:', userId);
        
        return { success: true };
      } catch (error) {
        console.error('Error during transaction:', error);
        throw error; // Re-throw to trigger transaction rollback
      }
    });

    // Transaction completed successfully
    console.log('Transaction completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete user: ' + error.message 
    }, { status: 500 });
  }
}
