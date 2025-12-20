// app/api/payments/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// Helper function to format payment data (same as in the main route.js)
const formatPaymentResponse = (payment) => {
  return {
    id: payment.id,
    invoiceId: payment.invoiceId,
    invoiceNumber: payment.invoice?.invoiceNumber,
    amount: payment.amount,
    paymentDate: payment.paymentDate,
    paymentMethod: payment.paymentMethod,
    reference: payment.reference,
    notes: payment.notes,
    status: payment.status,
    createdAt: payment.createdAt,
    client: payment.invoice?.client ? {
      id: payment.invoice.client.id,
      name: payment.invoice.client.name
    } : null
  };
};

// GET - Fetch a single payment by ID
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const paymentId = id;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check if payment exists and belongs to tenant
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenantId: user.tenantId
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            client: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }
    
    // Return the payment
    return NextResponse.json(formatPaymentResponse(payment));
  } catch (error) {
    console.error(`Error fetching payment ${paymentId}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch payment. Please try again.' },
      { status: 500 }
    );
  }
}

// PUT - Update a payment
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const paymentId = id;
    const body = await request.json();
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check if payment exists and belongs to tenant
    const existingPayment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenantId: user.tenantId
      },
      include: {
        invoice: {
          include: {
            payments: true
          }
        }
      }
    });
    
    if (!existingPayment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }
    
    // If changing amount, check if it exceeds invoice total
    if (body.amount !== undefined && body.amount !== existingPayment.amount) {
      const invoice = existingPayment.invoice;
      const otherPaymentsTotal = invoice.payments
        .filter(p => p.id !== paymentId)
        .reduce((sum, p) => sum + p.amount, 0);
        
      const remainingAmount = invoice.total - otherPaymentsTotal;
      
      if (body.amount > remainingAmount) {
        return NextResponse.json(
          { error: `Payment amount exceeds remaining invoice amount (${remainingAmount})` },
          { status: 400 }
        );
      }
    }
    
    // Prepare update data
    const updateData = {};
    
    // Only include fields that are provided in the request
    if (body.amount !== undefined) updateData.amount = body.amount;
    if (body.paymentDate !== undefined) updateData.paymentDate = new Date(body.paymentDate);
    if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod;
    if (body.reference !== undefined) updateData.reference = body.reference;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) updateData.status = body.status;
    
    // Update the payment
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: updateData,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            client: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    // If amount changed, update invoice status
    if (body.amount !== undefined && body.amount !== existingPayment.amount) {
      // Get all payments for the invoice
      const allPayments = await prisma.payment.findMany({
        where: {
          invoiceId: existingPayment.invoiceId,
          status: 'Completed'
        }
      });
      
      // Calculate total paid
      const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);
      const invoice = existingPayment.invoice;
      
      let newStatus;
      if (totalPaid >= invoice.total) {
        newStatus = 'Paid';
      } else if (totalPaid > 0) {
        newStatus = 'Partial';
      } else {
        newStatus = 'Pending';
      }
      
      await prisma.invoice.update({
        where: { id: existingPayment.invoiceId },
        data: { status: newStatus }
      });
    }
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_UPDATED',
        entityType: 'PAYMENT',
        entityId: updatedPayment.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          changes: updateData,
          invoiceNumber: updatedPayment.invoice.invoiceNumber
        })
      }
    });
    
    // Return updated payment
    return NextResponse.json({
      message: 'Payment updated successfully',
      payment: formatPaymentResponse(updatedPayment)
    });
  } catch (error) {
    console.error(`Error updating payment ${paymentId}:`, error);
    return NextResponse.json(
      { error: 'Failed to update payment. Please try again.' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a payment
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const paymentId = id;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check if payment exists and belongs to tenant
    const existingPayment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenantId: user.tenantId
      },
      include: {
        invoice: true
      }
    });
    
    if (!existingPayment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }
    
    // Store invoice details before deleting
    const invoiceId = existingPayment.invoiceId;
    const invoiceNumber = existingPayment.invoice.invoiceNumber;
    
    // Delete the payment
    await prisma.payment.delete({
      where: { id: paymentId }
    });
    
    // Update invoice status after payment deletion
    const remainingPayments = await prisma.payment.findMany({
      where: {
        invoiceId: invoiceId,
        status: 'Completed'
      }
    });
    
    const totalPaid = remainingPayments.reduce((sum, p) => sum + p.amount, 0);
    const invoice = existingPayment.invoice;
    
    let newStatus;
    if (totalPaid >= invoice.total) {
      newStatus = 'Paid';
    } else if (totalPaid > 0) {
      newStatus = 'Partial';
    } else {
      newStatus = 'Pending';
    }
    
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: newStatus }
    });
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_DELETED',
        entityType: 'PAYMENT',
        entityId: paymentId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          amount: existingPayment.amount,
          paymentMethod: existingPayment.paymentMethod,
          invoiceNumber: invoiceNumber
        })
      }
    });
    
    return NextResponse.json({
      message: 'Payment deleted successfully',
      paymentId: paymentId
    });
  } catch (error) {
    console.error(`Error deleting payment ${paymentId}:`, error);
    return NextResponse.json(
      { error: 'Failed to delete payment. Please try again.' },
      { status: 500 }
    );
  }
}