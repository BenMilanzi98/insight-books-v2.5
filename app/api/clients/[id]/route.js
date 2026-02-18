// app/api/clients/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// Helper function to get client by ID with validation
async function getClientWithValidation(id, tenantId) {
  const client = await prisma.client.findUnique({
    where: { id },
      select: {
        id: true,
        name: true,
        contactPerson: true,
        email: true,
        additionalEmails: true,
        phone: true,
        address: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
      // Get aggregate data for invoices
      invoices: {
        select: {
          id: true,
          total: true,
          status: true,
          issueDate: true,
          dueDate: true,
          payments: {
            select: {
              amount: true
            }
          }
        }
      },
      // Get aggregate data for sales (POS transactions)
      sales: {
        select: {
          id: true,
          total: true,
          status: true,
          saleDate: true
        }
      }
    }
  });
  
  if (!client) {
    return { error: 'Client not found', status: 404 };
  }
  
  // Security check: Ensure the client belongs to the user's tenant
  if (client.tenantId !== tenantId) {
    return { error: 'Access denied', status: 403 };
  }
  
  // Calculate financial metrics (invoices + sales)
  const totalBilledFromInvoices = client.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const totalBilledFromSales = client.sales.reduce((sum, sale) => sum + sale.total, 0);
  const totalBilled = totalBilledFromInvoices + totalBilledFromSales;
  
  const totalPaid = client.invoices.reduce((sum, invoice) => {
    return sum + invoice.payments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
  }, 0);
  
  // Outstanding amount (only from invoices, as sales are typically paid immediately)
  const outstandingAmount = totalBilledFromInvoices - totalPaid;
  
  // Determine client status based on activity (invoices OR sales)
  const hasActiveInvoices = client.invoices.some(invoice => 
    invoice.status !== 'cancelled' && invoice.status !== 'draft'
  );
  
  const hasActiveSales = client.sales.some(sale => 
    sale.status !== 'cancelled' && sale.status !== 'void'
  );
  
  const clientStatus = (hasActiveInvoices || hasActiveSales) ? 'Active' : 'Inactive';
  
  // Find the latest invoice date
  let lastInvoice = null;
  if (client.invoices.length > 0) {
    const sortedInvoices = [...client.invoices].sort((a, b) => 
      new Date(b.issueDate) - new Date(a.issueDate)
    );
    lastInvoice = sortedInvoices[0].issueDate;
  }
  
  // Return client with financial metrics
  return {
    client: {
      ...client,
      totalBilled,
      outstandingAmount,
      lastInvoice,
      status: clientStatus,
      invoices: undefined // Remove the full invoices array to reduce payload size
    }
  };
}

// GET - Fetch a single client by ID
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const clientId = id;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get client with validation
    const result = await getClientWithValidation(clientId, user.tenantId);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    
    return NextResponse.json(result.client);
  } catch (error) {
    console.error(`Error fetching client ${clientId}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch client. Please try again.' },
      { status: 500 }
    );
  }
}

// PUT - Update a client
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const clientId = id;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get client with validation
    const result = await getClientWithValidation(clientId, user.tenantId);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    
    const body = await request.json();
    
    // Check if email is being changed and if it's already in use by another client
    if (body.email && body.email !== result.client.email) {
      const emailExists = await prisma.client.findFirst({
        where: { 
          email: body.email,
          tenantId: user.tenantId,
          id: { not: clientId }
        }
      });
      
      if (emailExists) {
        return NextResponse.json(
          { error: 'A client with this email already exists' },
          { status: 400 }
        );
      }
    }
    
    // Prepare update data
    const updateData = {};
    
    // Only include fields that are provided in the request
    if (body.name !== undefined) updateData.name = body.name;
    if (body.contactPerson !== undefined) updateData.contactPerson = body.contactPerson;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.additionalEmails !== undefined) updateData.additionalEmails = Array.isArray(body.additionalEmails) ? body.additionalEmails : [];
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.address !== undefined) updateData.address = body.address;
    
    // Update the client
    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: updateData
    });
    
    // Create an audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'CLIENT_UPDATED',
        entityType: 'CLIENT',
        entityId: updatedClient.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify(updateData)
      }
    });
    
    // Get updated client with metrics
    const updatedResult = await getClientWithValidation(clientId, user.tenantId);
    
    // Return updated client
    return NextResponse.json({
      message: 'Client updated successfully',
      client: updatedResult.client
    });
  } catch (error) {
    console.error(`Error updating client ${clientId}:`, error);
    return NextResponse.json(
      { error: 'Failed to update client. Please try again.' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a client
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const clientId = id;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get client with validation
    const result = await getClientWithValidation(clientId, user.tenantId);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    
    // Check if client has invoices
    const invoiceCount = await prisma.invoice.count({
      where: { clientId }
    });
    
    if (invoiceCount > 0) {
      return NextResponse.json(
        { error: `This client has ${invoiceCount} invoices and cannot be deleted. Consider marking them as inactive instead.` },
        { status: 400 }
      );
    }
    
    // Delete the client
    await prisma.client.delete({
      where: { id: clientId }
    });
    
    // Create an audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'CLIENT_DELETED',
        entityType: 'CLIENT',
        entityId: clientId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          name: result.client.name,
          email: result.client.email
        })
      }
    });
    
    return NextResponse.json({
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting client ${clientId}:`, error);
    return NextResponse.json(
      { error: 'Failed to delete client. Please try again.' },
      { status: 500 }
    );
  }
}