// app/api/invoices/[id]/send/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { formatCurrency, formatDate } from '@/lib/invoiceCalculations';
import { multiplyMoney, percentOfMoney } from '@/lib/money';
import { shouldDisplayDocumentTax, documentHasLineTax } from '@/lib/documentTaxDisplay';
import {
  createTransport,
  getSmtpFromAddress,
  verifySmtpConnectionOptional,
} from '@/lib/emailService';
import {
  deleteInvoicePdf,
  findInvoicePdf,
} from '@/lib/invoicePdfStorage';
import fs from 'fs';
import nodemailer from 'nodemailer';

/** Escapes text for safe insertion into HTML email bodies. */
function escapeHtml(str) {
  if (str == null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request, context) {
    try {
      // Await params for Next.js 15 compatibility
      const { id: invoiceId } = await context.params;
      
      // Get user from session
      const user = await getUserFromSession(request);
      if (!user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      
      // Get invoice to send
      const invoice = await prisma.invoice.findUnique({
        where: {
          id: invoiceId,
          tenantId: user.tenantId
        },
        include: {
          client: true,
          items: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });
      
      if (!invoice) {
        return NextResponse.json(
          { error: 'Invoice not found' },
          { status: 404 }
        );
      }
      
      // Get email customization options (JSON body or multipart formData with optional attachments)
      const contentType = request.headers.get('content-type') || '';
      let customMessage = '';
      let templateId = null;
      let userAttachmentFiles = [];
      let otherEmailsFromRequest = [];
      if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        customMessage = (formData.get('message') ?? '').toString();
        const tid = formData.get('templateId');
        templateId = tid != null && tid !== '' ? tid.toString() : null;
        const otherEmailsRaw = formData.get('otherEmails');
        if (otherEmailsRaw != null && typeof otherEmailsRaw === 'string') {
          try {
            const parsed = JSON.parse(otherEmailsRaw);
            otherEmailsFromRequest = Array.isArray(parsed) ? parsed.filter((e) => e && typeof e === 'string') : [];
          } catch (_) {}
        }
        for (const [key, value] of formData.entries()) {
          if (key === 'attachments' && value != null && typeof value.arrayBuffer === 'function') {
            userAttachmentFiles.push(value);
          }
        }
      } else {
        const body = await request.json().catch(() => ({}));
        customMessage = body?.message || '';
        templateId = body?.templateId;
        const raw = body?.otherEmails;
        otherEmailsFromRequest = Array.isArray(raw) ? raw.filter((e) => e && typeof e === 'string') : [];
      }
      
      // Get all client email addresses (primary + additional) plus any "other" emails from the request
      const seen = new Set();
      const clientEmails = [];
      if (invoice.client.email) {
        const e = invoice.client.email.trim().toLowerCase();
        if (e && !seen.has(e)) {
          seen.add(e);
          clientEmails.push(invoice.client.email);
        }
      }
      if (invoice.client.additionalEmails && invoice.client.additionalEmails.length > 0) {
        for (const email of invoice.client.additionalEmails) {
          const e = (email || '').trim().toLowerCase();
          if (e && !seen.has(e)) {
            seen.add(e);
            clientEmails.push(email);
          }
        }
      }
      for (const email of otherEmailsFromRequest) {
        const e = (email || '').trim().toLowerCase();
        if (e && !seen.has(e)) {
          seen.add(e);
          clientEmails.push(email.trim());
        }
      }
      
      if (clientEmails.length === 0) {
        return NextResponse.json(
          { error: 'Client does not have an email address' },
          { status: 400 }
        );
      }
      
      // Fetch tenant for branding info
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        include: { settings: true }
      });
      
      // Fetch the invoice template
      let template = null;
      if (templateId) {
        template = await prisma.invoiceTemplate.findUnique({
          where: { id: templateId }
        });
      } 
      // If no template specified or not found, use tenant's default template
      if (!template) {
        template = await prisma.invoiceTemplate.findFirst({
          where: {
            OR: [
              { tenantId: user.tenantId, isDefault: true },
              { tenantId: user.tenantId }
            ]
          },
          orderBy: {
            isDefault: 'desc'
          }
        });
      }
      
      const isPaid = invoice.status === 'Paid';
      // Generate email HTML content with enhanced invoice design
      const invoiceHtml = generateInvoiceHtml(invoice, tenant, isPaid);
      

      const transporter = createTransport();
      await verifySmtpConnectionOptional(transporter, 'invoice email');

      const pdfFound = findInvoicePdf(invoiceId, invoice.invoiceNumber);
      if (!pdfFound) {
        console.error('PDF file not found for invoice:', invoiceId);
        return NextResponse.json({
          error: 'PDF file not found. Please try generating the invoice again.',
        }, { status: 404 });
      }

      const { filePath, filename: foundFilename } = pdfFound;
      console.log(`Found PDF file: ${foundFilename} at ${filePath}`);
      const pdfBuffer = fs.readFileSync(filePath);

      const companyName = tenant?.name || 'InsightBooks';
      const fromEmail = getSmtpFromAddress(companyName);
      const replyTo =
        tenant?.settings?.businessEmail ||
        process.env.EMAIL_FROM ||
        process.env.EMAIL_USER;

      const mailOptions = {
        from: fromEmail,
        replyTo,
        to: clientEmails.join(', '), // Send to all email addresses
        subject: isPaid ? `Payment Confirmation - Invoice #${invoice.invoiceNumber} from ${companyName}` : `Invoice #${invoice.invoiceNumber} from ${companyName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: ${tenant?.primaryColor || '#4338ca'};">${escapeHtml(companyName)}</h2>
            </div>
            <p>Hello ${escapeHtml(invoice.client.name)},</p>
            <p>${isPaid ? `Your invoice #${escapeHtml(String(invoice.invoiceNumber))} has been paid. Please find the payment confirmation below.` : `Please find your invoice #${escapeHtml(String(invoice.invoiceNumber))} below.`}</p>
            ${customMessage ? `<p>${escapeHtml(customMessage)}</p>` : ''}

            ${invoiceHtml}

            <p style="margin-top: 20px;">If you have any questions about this invoice, please contact us.</p>
            <p>Thank you for your business!</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #6b7280;">
              <p>${escapeHtml(tenant?.settings?.emailFooter || `© ${new Date().getFullYear()} ${companyName}. All rights reserved.`)}</p>
            </div>
          </div>
        `,
        // Add plain text alternative
        text: `Hello ${invoice.client.name},\n\n${isPaid ? `Your invoice #${invoice.invoiceNumber} has been paid. Please find the payment confirmation below.` : `Please find your invoice #${invoice.invoiceNumber} below.`}\n\n${customMessage ? customMessage + '\n\n' : ''}Total amount: ${formatCurrency(invoice.total)}\nDue date: ${formatDate(invoice.dueDate)}\n\nIf you have any questions about this invoice, please contact us.\n\nThank you for your business!\n\n© ${new Date().getFullYear()} ${companyName}. All rights reserved.`,
        attachments: [
          {
            filename: foundFilename || `invoice-${invoiceId}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      };
      // Append user-provided attachments (from multipart form)
      for (const file of userAttachmentFiles) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const name = file.name || `attachment-${Date.now()}`;
        mailOptions.attachments.push({
          filename: name,
          content: buffer
        });
      }
      
      console.log('Sending invoice email with options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject
      });
      
      // Send the email
      const info = await transporter.sendMail(mailOptions);
      
      if (Array.isArray(info.rejected) && info.rejected.length > 0) {
        throw new Error(`Email rejected by server: ${info.rejected.join(', ')}`);
      }

      console.log('Invoice email sent successfully:', {
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected
      });
      
      try {
        if (deleteInvoicePdf(invoiceId, invoice.invoiceNumber)) {
          console.log(`PDF file deleted for invoice ${invoiceId}`);
        } else {
          console.log('No PDF file found to delete - this is normal if file was already cleaned up');
        }
      } catch (deleteError) {
        console.error('Failed to delete PDF file:', deleteError);
        // Don't fail the entire process if file deletion fails
      }
      
      // If using ethereal for development, log the URL to view the email
      if (info.messageUrl) {
        console.log('Preview URL: %s', info.messageUrl);
      } else if (nodemailer.getTestMessageUrl && nodemailer.getTestMessageUrl(info)) {
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      }
      
      // Update invoice status if it's a draft
      let statusUpdated = false;
      let updatedInvoice = invoice;
      
      if (invoice.status === 'Draft') {
        statusUpdated = true;
        updatedInvoice = await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'Pending'
          },
          include: {
            client: true,
            items: true
          }
        });
      }
      
      // Log the email sending
      await prisma.auditLog.create({
        data: {
          action: 'INVOICE_SENT',
          entityType: 'INVOICE',
          entityId: invoiceId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            invoiceNumber: invoice.invoiceNumber,
            clientId: invoice.clientId,
            clientEmail: invoice.client.email,
            messageId: info.messageId,
            statusUpdated
          })
        }
      });
      
      return NextResponse.json({
        message: 'Invoice sent successfully',
        invoice: updatedInvoice,
        statusUpdated,
        emailSent: true,
        messageId: info.messageId
      });
    } catch (error) {
      console.error('Error sending invoice:', error);
      const message = error?.message || 'Unknown error';
      const isSmtp =
        error?.code === 'EAUTH' ||
        error?.code === 'ESOCKET' ||
        /smtp|mail|recipient|sender/i.test(message);
      return NextResponse.json(
        {
          error: isSmtp
            ? `Failed to send invoice email: ${message}. Check SMTP settings and that the From address matches your mail account.`
            : `Failed to send invoice: ${message}`,
        },
        { status: 500 }
      );
    }
}

/**
 * Generate HTML representation of the invoice
 * Improved design that works well in email clients
 */
function generateInvoiceHtml(invoice, tenant, isPaid = false) {
  const primaryColor = tenant?.primaryColor || '#4338ca';
  let logoUrl = tenant?.logoUrl;
  if (logoUrl && logoUrl.startsWith('/')) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    logoUrl = `${baseUrl}${logoUrl}`;
  }
  const showLineTax = documentHasLineTax(invoice.items);
  const showDocumentTax = shouldDisplayDocumentTax({
    taxAmount: invoice.taxAmount,
    taxLines: (invoice.items || []).flatMap((item) => item.itemTaxes || []),
  });
  // Generate HTML for invoice items with per-line tax breakdown (VAT, withholding, etc. visible)
  const itemsHtml = invoice.items.map(item => {
    const lineTotal = multiplyMoney(item.quantity, item.unitPrice);
    const taxRate = Number(item.taxRate) || 0;
    const lineTaxAmount = percentOfMoney(lineTotal, taxRate);
    const taxLabel = taxRate > 0 ? `Tax (${taxRate}%): ${formatCurrency(lineTaxAmount)}` : '—';
    const title = escapeHtml((item.description && String(item.description).trim()) || 'Item');
    return `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${title}</td>
        <td style="padding: 10px; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; text-align: right;">${formatCurrency(item.unitPrice)}</td>
        ${showLineTax ? `<td style="padding: 10px; text-align: right; font-size: 11px; color: #4b5563;">${taxLabel}</td>` : ''}
        <td style="padding: 10px; text-align: right;">${formatCurrency(lineTotal)}</td>
      </tr>
    `;
  }).join('');
  
  return `
    <div style="font-family: Arial, sans-serif; margin: 20px 0; border: 1px solid #e0e0e0; border-radius: 5px; overflow: hidden;">
      <!-- Header -->
      <div style="background-color: ${primaryColor}; padding: 20px; color: white;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <h1 style="margin: 0; font-size: 24px;">${isPaid ? 'PAYMENT CONFIRMATION' : 'INVOICE'}</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">#${escapeHtml(invoice.invoiceNumber)}</p>
            </td>
            <td style="text-align: right;">
              ${logoUrl ? 
                `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(tenant?.name || 'Company')}" style="max-height: 80px; background: white; padding: 8px; border-radius: 6px;">` : 
                `<h2 style="margin: 0; color: white;">${escapeHtml(tenant?.name || 'InsightBooks')}</h2>`}
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Client and Invoice Info -->
      <div style="padding: 20px; background-color: #f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width: 50%; vertical-align: top;">
              <h3 style="color: #6b7280; margin-top: 0; margin-bottom: 10px; font-size: 14px; text-transform: uppercase;">Bill To:</h3>
              <p style="margin: 0 0 5px 0; font-weight: bold;">${escapeHtml(invoice.client.name)}</p>
              ${invoice.client.contactPerson ? `<p style="margin: 0 0 5px 0;">Attn: ${escapeHtml(invoice.client.contactPerson)}</p>` : ''}
              ${invoice.client.address ? `<p style="margin: 0 0 5px 0;">${escapeHtml(invoice.client.address)}</p>` : ''}
              <p style="margin: 0 0 5px 0;">${escapeHtml(invoice.client.email)}</p>
              ${invoice.client.phone ? `<p style="margin: 0 0 5px 0;">Phone: ${escapeHtml(invoice.client.phone)}</p>` : ''}
            </td>
            <td style="width: 50%; vertical-align: top;">
              <h3 style="color: #6b7280; margin-top: 0; margin-bottom: 10px; font-size: 14px; text-transform: uppercase;">Invoice Details:</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom: 5px;"><strong>Issue Date:</strong></td>
                  <td style="padding-bottom: 5px; text-align: right;">${formatDate(invoice.issueDate)}</td>
                </tr>
                <tr>
                  <td style="padding-bottom: 5px;"><strong>Due Date:</strong></td>
                  <td style="padding-bottom: 5px; text-align: right;">${formatDate(invoice.dueDate)}</td>
                </tr>
                <tr>
                  <td style="padding-bottom: 5px;"><strong>Status:</strong></td>
                  <td style="padding-bottom: 5px; text-align: right;">
                    <span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 12px; background-color: ${
                      invoice.status === 'Paid' ? '#d1fae5' : 
                      invoice.status === 'Pending' ? '#fef3c7' : 
                      invoice.status === 'Overdue' ? '#fee2e2' : '#f3f4f6'
                    }; color: ${
                      invoice.status === 'Paid' ? '#065f46' : 
                      invoice.status === 'Pending' ? '#92400e' : 
                      invoice.status === 'Overdue' ? '#b91c1c' : '#374151'
                    };">
                      ${escapeHtml(invoice.status)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Invoice Items -->
      <div style="padding: 0 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Description</th>
              <th style="padding: 10px; text-align: center; font-size: 12px; text-transform: uppercase; color: #6b7280;">Qty</th>
              <th style="padding: 10px; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280;">Rate</th>
              ${showLineTax ? '<th style="padding: 10px; text-align: center; font-size: 12px; text-transform: uppercase; color: #6b7280;">Tax</th>' : ''}
              <th style="padding: 10px; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>
      
      <!-- Totals -->
      <div style="padding: 0 20px 20px; text-align: right;">
        <table width="250" cellpadding="0" cellspacing="0" style="margin-left: auto;">
          <tr>
            <td style="padding: 5px 0;"><span style="color: #6b7280;">Subtotal:</span></td>
            <td style="padding: 5px 0; text-align: right;">${formatCurrency(invoice.subtotal)}</td>
          </tr>
          ${showDocumentTax ? `
          <tr>
            <td style="padding: 5px 0;"><span style="color: #6b7280;">Tax:</span></td>
            <td style="padding: 5px 0; text-align: right;">${formatCurrency(invoice.taxAmount)}</td>
          </tr>` : ''}
          <tr style="border-top: 2px solid #e5e7eb;">
            <td style="padding: 10px 0; font-weight: bold; font-size: 18px; color: ${primaryColor};">Total:</td>
            <td style="padding: 10px 0; font-weight: bold; font-size: 18px; text-align: right; color: ${primaryColor};">${formatCurrency(invoice.total)}</td>
          </tr>
        </table>
      </div>
      
      <!-- Notes -->
      <div style="padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
        <h3 style="color: #6b7280; margin-top: 0; margin-bottom: 10px; font-size: 14px; text-transform: uppercase;">Notes:</h3>
        <p style="margin: 0; color: #4b5563;">${escapeHtml(invoice.notes || 'Thank you for your business!')}</p>
      </div>
    </div>
  `;
}