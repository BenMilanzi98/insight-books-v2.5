// lib/balanceReminderService.js
/**
 * Balance Reminder Service
 * Handles sending balance reminder emails to clients with customizable templates
 */

import prisma from './prisma';
import { createTransport } from './emailService';

/**
 * Default balance reminder template
 */
const DEFAULT_TEMPLATE = {
  subject: 'Outstanding Balance Reminder - {{companyName}}',
  body: `
Dear {{clientName}},

This is a friendly reminder that you have an outstanding balance with {{companyName}}.

**Outstanding Balance Summary:**
- Total Outstanding: {{totalBalance}}
- Number of Invoices: {{invoiceCount}}
- Oldest Invoice: {{oldestInvoiceDate}}

**Outstanding Invoices:**
{{invoiceList}}

Please arrange payment at your earliest convenience. If you have already made a payment, please disregard this notice.

If you have any questions or concerns, please don't hesitate to contact us.

Thank you for your business!

Best regards,
{{companyName}}
  `.trim()
};

/**
 * Get balance reminder template for tenant
 * Falls back to default if no custom template exists
 */
export async function getBalanceReminderTemplate(tenantId) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true }
    });

    // Check if tenant has custom template stored (could be in settings or separate table)
    // For now, we'll use default template but allow customization via settings
    const customSubject = tenant?.settings?.balanceReminderSubject;
    const customBody = tenant?.settings?.balanceReminderBody;

    return {
      subject: customSubject || DEFAULT_TEMPLATE.subject,
      body: customBody || DEFAULT_TEMPLATE.body
    };
  } catch (error) {
    console.error('Error fetching balance reminder template:', error);
    return DEFAULT_TEMPLATE;
  }
}

/**
 * Replace template variables with actual values
 */
function replaceTemplateVariables(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
}

/**
 * Format invoice list for email
 */
function formatInvoiceList(invoices) {
  if (!invoices || invoices.length === 0) {
    return 'No outstanding invoices.';
  }

  return invoices.map(invoice => {
    const dueDate = new Date(invoice.dueDate).toLocaleDateString();
    const balance = invoice.balanceDue || (invoice.total - (invoice.totalPaid || 0));
    return `- Invoice #${invoice.invoiceNumber}: ${balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} (Due: ${dueDate})`;
  }).join('\n');
}

/**
 * Get filled subject and body for a balance reminder (for email or PDF).
 * Returns null only if client not found. If client has no outstanding balance,
 * returns a short "no amount due" statement so PDF can still be generated.
 */
export async function getBalanceReminderContent(clientId, tenantId) {
  const client = await prisma.client.findUnique({
    where: { id: clientId, tenantId },
    include: {
      tenant: {
        include: { settings: true }
      }
    }
  });
  if (!client) return null;

  const companyName = client.tenant?.name || 'Our Company';
  const balanceInfo = await getClientOutstandingBalance(clientId, tenantId);

  const currencyCode = client.tenant.settings?.currencyCode || 'USD';
  const totalBalanceFormatted = balanceInfo.totalBalance.toLocaleString('en-US', {
    style: 'currency',
    currency: currencyCode
  });
  const invoicesForPdf = balanceInfo.invoices.map(inv => ({
    invoiceNumber: inv.invoiceNumber,
    dueDate: inv.dueDate,
    balanceDue: inv.balanceDue
  }));

  if (balanceInfo.totalBalance === 0) {
    return {
      subject: `Balance statement - ${companyName}`,
      body: `Dear ${client.name},\n\nYou have no outstanding balance with ${companyName}.\n\nThank you for your business.`,
      clientName: client.name,
      companyName,
      totalBalance: 0,
      currencyCode,
      invoiceCount: 0,
      oldestInvoiceDate: 'N/A',
      invoices: []
    };
  }

  const template = await getBalanceReminderTemplate(tenantId);
  const variables = {
    clientName: client.name,
    companyName,
    totalBalance: totalBalanceFormatted,
    invoiceCount: balanceInfo.invoiceCount.toString(),
    oldestInvoiceDate: balanceInfo.oldestInvoiceDate,
    invoiceList: formatInvoiceList(balanceInfo.invoices)
  };
  return {
    subject: replaceTemplateVariables(template.subject, variables),
    body: replaceTemplateVariables(template.body, variables),
    clientName: client.name,
    companyName,
    totalBalance: balanceInfo.totalBalance,
    currencyCode,
    invoiceCount: balanceInfo.invoiceCount,
    oldestInvoiceDate: balanceInfo.oldestInvoiceDate,
    invoices: invoicesForPdf
  };
}

// Statuses to exclude (draft/void/refund/cancelled). Any other status is included so we compute balance from total - totalPaid.
const EXCLUDED_INVOICE_STATUSES = ['Draft', 'draft', 'void', 'refunded', 'partially_refunded', 'cancelled', 'Cancelled'];

/**
 * Get client's outstanding balance and invoices.
 * Fetches all non-voided, non-refunded invoices (except drafts/cancelled), then computes
 * balanceDue = total - totalPaid. Adjusts for posted credit notes (reduce balance) and
 * debit notes (increase balance) for a full AR picture.
 */
export async function getClientOutstandingBalance(clientId, tenantId) {
  const [invoices, creditNotes, debitNotes] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        clientId,
        tenantId,
        status: { notIn: EXCLUDED_INVOICE_STATUSES },
        voidedAt: null,
        refundedAt: null
      },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        dueDate: true,
        total: true,
        totalPaid: true,
        status: true
      },
      orderBy: { dueDate: 'asc' }
    }),
    prisma.creditNote.findMany({
      where: { clientId, tenantId, status: 'Posted' },
      select: { id: true, noteNumber: true, amount: true, noteDate: true }
    }),
    prisma.debitNote.findMany({
      where: { clientId, tenantId, status: 'Posted' },
      select: { id: true, noteNumber: true, amount: true, noteDate: true }
    })
  ]);

  // Calculate actual remaining balance from payments
  const invoicesWithBalance = invoices.map(invoice => {
    const actualTotalPaid = invoice.totalPaid || 0;
    const actualRemaining = Math.max(0, parseFloat(invoice.total || 0) - actualTotalPaid);
    return {
      ...invoice,
      balanceDue: actualRemaining
    };
  }).filter(inv => inv.balanceDue > 0);

  const invoiceTotal = invoicesWithBalance.reduce((sum, inv) => sum + inv.balanceDue, 0);
  const creditTotal = creditNotes.reduce((sum, n) => sum + parseFloat(n.amount || 0), 0);
  const debitTotal = debitNotes.reduce((sum, n) => sum + parseFloat(n.amount || 0), 0);
  const totalBalance = invoiceTotal - creditTotal + debitTotal;

  const oldestInvoice = invoicesWithBalance.length > 0
    ? invoicesWithBalance[0]
    : null;

  return {
    totalBalance,
    invoiceCount: invoicesWithBalance.length,
    invoices: invoicesWithBalance,
    creditNotes,
    debitNotes,
    oldestInvoiceDate: oldestInvoice ? new Date(oldestInvoice.dueDate).toLocaleDateString() : 'N/A'
  };
}

/**
 * Send balance reminder email to client
 */
export async function sendBalanceReminder(clientId, tenantId, options = {}) {
  try {
    // Get client
    const client = await prisma.client.findUnique({
      where: { id: clientId, tenantId },
      include: {
        tenant: {
          include: {
            settings: true
          }
        }
      }
    });

    if (!client) {
      throw new Error('Client not found');
    }

    // Get all email addresses for client
    const emailAddresses = [];
    if (client.email) {
      emailAddresses.push(client.email);
    }
    if (client.additionalEmails && client.additionalEmails.length > 0) {
      emailAddresses.push(...client.additionalEmails);
    }

    if (emailAddresses.length === 0) {
      throw new Error('Client has no email address');
    }

    // Get outstanding balance
    const balanceInfo = await getClientOutstandingBalance(clientId, tenantId);

    if (balanceInfo.totalBalance === 0) {
      return {
        success: false,
        message: 'Client has no outstanding balance'
      };
    }

    // Get template
    const template = await getBalanceReminderTemplate(tenantId);

    // Prepare template variables
    const companyName = client.tenant.name || 'Our Company';
    const tenantEmail = client.tenant.settings?.businessEmail || process.env.EMAIL_FROM || 'noreply@insightbooksafrica.com';
    
    const variables = {
      clientName: client.name,
      companyName: companyName,
      totalBalance: balanceInfo.totalBalance.toLocaleString('en-US', { 
        style: 'currency', 
        currency: client.tenant.settings?.currencyCode || 'USD' 
      }),
      invoiceCount: balanceInfo.invoiceCount.toString(),
      oldestInvoiceDate: balanceInfo.oldestInvoiceDate,
      invoiceList: formatInvoiceList(balanceInfo.invoices)
    };

    // Replace template variables
    const subject = replaceTemplateVariables(template.subject, variables);
    const body = replaceTemplateVariables(template.body, variables);

    // Convert body to HTML
    const htmlBody = body.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Create email HTML
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: ${client.tenant.primaryColor || '#4338ca'};">${companyName}</h2>
        </div>
        <div style="line-height: 1.6; color: #111827;">
          ${htmlBody}
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #6b7280;">
          <p>${client.tenant.settings?.emailFooter || `© ${new Date().getFullYear()} ${companyName}. All rights reserved.`}</p>
        </div>
      </div>
    `;

    // Send email to all addresses
    const transporter = createTransport();
    const results = [];

    for (const email of emailAddresses) {
      try {
        const info = await transporter.sendMail({
          from: `"${companyName}" <${tenantEmail}>`,
          replyTo: tenantEmail,
          to: email,
          subject: subject,
          html: emailHtml,
          text: body
        });

        results.push({
          email,
          success: true,
          messageId: info.messageId
        });
      } catch (error) {
        results.push({
          email,
          success: false,
          error: error.message
        });
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'BALANCE_REMINDER_SENT',
        entityType: 'CLIENT',
        entityId: clientId,
        userId: options.userId || null,
        tenantId: tenantId,
        details: JSON.stringify({ 
          totalBalance: balanceInfo.totalBalance,
          invoiceCount: balanceInfo.invoiceCount,
          emails: emailAddresses,
          results
        })
      }
    });

    return {
      success: true,
      message: `Balance reminder sent to ${results.filter(r => r.success).length} of ${emailAddresses.length} email address(es)`,
      results
    };
  } catch (error) {
    console.error('Error sending balance reminder:', error);
    throw error;
  }
}

/**
 * Send balance reminders to multiple clients
 */
export async function sendBalanceRemindersToClients(clientIds, tenantId, userId = null) {
  const results = [];
  
  for (const clientId of clientIds) {
    try {
      const result = await sendBalanceReminder(clientId, tenantId, { userId });
      results.push({
        clientId,
        ...result
      });
    } catch (error) {
      results.push({
        clientId,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}
