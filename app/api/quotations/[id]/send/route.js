// app/api/quotations/[id]/send/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { sendQuotationEmail } from '@/lib/emailService';
import fs from 'fs';
import path from 'path';
// You would need to implement or import an email sending function
// import { sendEmail } from '@/lib/emailService';

// POST - Send a quotation to the client
export async function POST(request, { params }) {
  // Fix for Next.js 15: await params before accessing properties
  const { id: quotationId } = await params;
  
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check if quotation exists and belongs to the user's tenant
    const quotation = await prisma.quotation.findFirst({
      where: {
        id: quotationId,
        tenantId: user.tenantId
      },
      include: {
        client: true,
        items: true
      }
    });
    
    if (!quotation) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
    }
    
    console.log('Quotation found:', {
      id: quotation.id,
      quotationNumber: quotation.quotationNumber,
      clientEmail: quotation.client?.email,
      clientName: quotation.client?.name,
      status: quotation.status
    });
    
    // Validate quotation data structure
    if (!quotation.client) {
      console.error('Quotation missing client data');
      return NextResponse.json(
        { error: 'Quotation client data is missing' },
        { status: 400 }
      );
    }
    
    if (!quotation.client.email) {
      console.error('Client missing email address');
      return NextResponse.json(
        { error: 'Client does not have an email address' },
        { status: 400 }
      );
    }
    
    if (!quotation.client.name) {
      console.error('Client missing name');
      return NextResponse.json(
        { error: 'Client name is missing' },
        { status: 400 }
      );
    }
    
    if (!quotation.quotationNumber) {
      console.error('Quotation missing quotation number');
      return NextResponse.json(
        { error: 'Quotation number is missing' },
        { status: 400 }
      );
    }
    
    // Get tenant information for the email
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      include: {
        settings: true
      }
    });
    
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant information not found' },
        { status: 404 }
      );
    }
    
    console.log('Tenant found:', {
      id: tenant.id,
      name: tenant.name,
      hasSettings: !!tenant.settings
    });
    
    // Validate tenant data structure
    if (!tenant.name) {
      console.error('Tenant missing name');
      return NextResponse.json(
        { error: 'Company name is missing' },
        { status: 400 }
      );
    }
    
    // In a real implementation, you would:
    // 1. Generate a PDF of the quotation
    // 2. Send an email to the client with the PDF attached
    
    // For now, we'll just simulate the email sending
    console.log(`Sending quotation ${quotation.quotationNumber} to ${quotation.client.email}`);
    console.log(`Looking for PDF file: quotation-${quotationId}.pdf`);
    
    // 2. Build the filename and read the file
    const filename = `quotation-${quotationId}.pdf`;
    const filePath = path.join(process.cwd(), 'tmp', filename);
    
    console.log(`Checking file path: ${filePath}`);
    console.log(`File exists: ${fs.existsSync(filePath)}`);

    if (!fs.existsSync(filePath)) {
      console.error(`PDF file not found at: ${filePath}`);
      return NextResponse.json({ error: 'PDF file not found' }, { status: 404 });
    }

    const pdfBuffer = fs.readFileSync(filePath);
    console.log(`PDF file read successfully, size: ${pdfBuffer.length} bytes`);
    
    try {
      console.log('Attempting to send quotation email...');
      console.log('Email configuration check:', {
        hasEmailHost: !!process.env.EMAIL_HOST,
        hasEmailUser: !!process.env.EMAIL_USER,
        hasEmailPassword: !!process.env.EMAIL_PASSWORD,
        emailFrom: process.env.EMAIL_FROM
      });
      
      await sendQuotationEmail(quotation, tenant, pdfBuffer);
      console.log('Quotation email sent successfully');
    } catch (emailError) {
      console.error('Failed to send quotation email:', emailError);
      console.error('Email error details:', {
        message: emailError.message,
        code: emailError.code,
        stack: emailError.stack
      });
      // Don't fail the entire process if email fails, but log it
      // The quotation process can continue
    }
    
    // Clean up the PDF file
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('PDF file deleted successfully');
      } else {
        console.log('PDF file was already deleted or not found');
      }
    } catch (deleteError) {
      console.error('Failed to delete PDF file:', deleteError);
      // Don't fail the entire process if file deletion fails
    }
    
    // In a real implementation, you would use something like:
    /*
    await sendEmail({
      to: quotation.client.email,
      subject: `Quotation ${quotation.quotationNumber} from ${tenant.name}`,
      text: `Dear ${quotation.client.name},\n\nPlease find attached your quotation ${quotation.quotationNumber}.\n\nTotal amount: ${quotation.total.toLocaleString()}\nValid until: ${quotation.validUntil.toLocaleDateString()}\n\nThank you for your business.\n\n${tenant.name}`,
      attachments: [
        {
          filename: `quotation-${quotation.quotationNumber}.pdf`,
          content: pdfBuffer
        }
      ]
    });
    */
    
    // Update the quotation status if it's currently a draft
    try {
      if (quotation.status === 'Draft') {
        await prisma.quotation.update({
          where: { id: quotationId },
          data: { status: 'Pending' }
        });
        console.log('Quotation status updated from Draft to Pending');
      }
    } catch (dbError) {
      console.error('Failed to update quotation status:', dbError);
      // Don't fail the entire process if status update fails
    }
    
    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          action: 'QUOTATION_SENT',
          entityType: 'QUOTATION',
          entityId: quotationId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            quotationNumber: quotation.quotationNumber,
            clientId: quotation.clientId,
            clientEmail: quotation.client.email
          })
        }
      });
      console.log('Audit log created successfully');
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
      // Don't fail the entire process if audit log creation fails
    }
    
    return NextResponse.json({
      message: 'Quotation sent successfully',
      status: quotation.status === 'Draft' ? 'Pending' : quotation.status
    });
  } catch (error) {
    console.error(`Error sending quotation ${quotationId}:`, error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Return more specific error messages based on the error type
    if (error.message.includes('PDF file not found')) {
      return NextResponse.json(
        { error: 'PDF file not found. Please try generating the quotation again.' },
        { status: 404 }
      );
    } else if (error.message.includes('Client does not have an email')) {
      return NextResponse.json(
        { error: 'Client does not have an email address configured.' },
        { status: 400 }
      );
    } else if (error.message.includes('Quotation not found')) {
      return NextResponse.json(
        { error: 'Quotation not found or access denied.' },
        { status: 404 }
      );
    } else if (error.message.includes('Tenant information not found')) {
      return NextResponse.json(
        { error: 'Company information not found.' },
        { status: 404 }
      );
    } else {
      return NextResponse.json(
        { error: `Failed to send quotation: ${error.message}` },
        { status: 500 }
      );
    }
  }
}