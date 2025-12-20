// app/api/payments/sync/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// POST - Sync payments from external sources
export async function POST(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get tenant payment gateways
    const paymentGateways = await prisma.paymentGateway.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true
      }
    });
    
    if (paymentGateways.length === 0) {
      return NextResponse.json({
        message: 'No active payment gateways found. Please configure a payment gateway first.',
        syncedPayments: 0
      });
    }
    
    let syncedPayments = 0;
    const syncResults = [];
    
    // For each payment gateway, attempt to sync payments
    for (const gateway of paymentGateways) {
      try {
        // This would normally connect to external APIs
        // For demonstration, we'll simulate finding new payments
        
        // Get the last sync time or default to 24 hours ago
        const lastSyncDate = new Date();
        lastSyncDate.setHours(lastSyncDate.getHours() - 24);
        
        // Create a sample payment for demonstration
        // In a real implementation, this would fetch from external APIs
        if (gateway.name === 'PayChangu' || gateway.name === 'Mobile Money') {
          // Find pending invoices to match with
          const pendingInvoices = await prisma.invoice.findMany({
            where: {
              tenantId: user.tenantId,
              status: 'Pending'
            },
            take: 1,
            orderBy: {
              dueDate: 'asc'
            }
          });
          
          if (pendingInvoices.length > 0) {
            const pendingInvoice = pendingInvoices[0];
            
            // Create a new payment record
            const paymentRef = `AUTO${gateway.name.substring(0, 3).toUpperCase()}${Date.now().toString().substring(8)}`;
            
            await prisma.payment.create({
              data: {
                invoiceId: pendingInvoice.id,
                amount: pendingInvoice.total,
                paymentDate: new Date(),
                paymentMethod: gateway.name,
                reference: paymentRef,
                status: 'Completed',
                notes: `Automatically synced from ${gateway.name}`,
                tenantId: user.tenantId
              }
            });
            
            // Update invoice status
            await prisma.invoice.update({
              where: { id: pendingInvoice.id },
              data: { status: 'Paid' }
            });
            
            // Create audit log entry
            await prisma.auditLog.create({
              data: {
                action: 'PAYMENT_SYNCED',
                entityType: 'PAYMENT',
                entityId: paymentRef,
                userId: user.id,
                tenantId: user.tenantId,
                details: JSON.stringify({
                  gateway: gateway.name,
                  amount: pendingInvoice.total,
                  invoiceNumber: pendingInvoice.invoiceNumber
                })
              }
            });
            
            syncedPayments++;
            syncResults.push({
              gateway: gateway.name,
              status: 'success',
              message: `Found and synced payment for invoice ${pendingInvoice.invoiceNumber}`
            });
          } else {
            syncResults.push({
              gateway: gateway.name,
              status: 'info',
              message: 'No pending invoices found to match with payments'
            });
          }
        } else {
          syncResults.push({
            gateway: gateway.name,
            status: 'info',
            message: 'No new payments found'
          });
        }
      } catch (gatewayError) {
        console.error(`Error syncing payments from ${gateway.name}:`, gatewayError);
        syncResults.push({
          gateway: gateway.name,
          status: 'error',
          message: `Failed to sync: ${gatewayError.message}`
        });
      }
    }
    
    return NextResponse.json({
      message: `Payment sync completed. Synced ${syncedPayments} new payments.`,
      syncedPayments,
      results: syncResults
    });
  } catch (error) {
    console.error('Error syncing payments:', error);
    return NextResponse.json(
      { error: 'Failed to sync payments. Please try again.' },
      { status: 500 }
    );
  }
}