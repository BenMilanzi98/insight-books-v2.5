import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { createTransport } from '@/lib/emailService';

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Support multipart form data with attachments
    const contentType = request.headers.get('content-type') || '';
    let clientId, to, subject, message, replyTo, attachments = [];

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      clientId = form.get('clientId');
      to = form.get('to');
      subject = form.get('subject');
      message = form.get('message');
      replyTo = form.get('replyTo') || 'insightinnovationsltd@gmail.com';
      const files = form.getAll('attachments');
      attachments = (files || []).map((f) => ({ filename: f.name, content: Buffer.from(new Uint8Array(f.arrayBuffer ? [] : [])) }));
      // Properly read file buffers
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const buf = Buffer.from(await file.arrayBuffer());
        attachments[i] = { filename: file.name, content: buf, contentType: file.type };
      }
    } else {
      const body = await request.json();
      clientId = body.clientId;
      to = body.to;
      subject = body.subject;
      message = body.message;
      replyTo = body.replyTo || 'insightinnovationsltd@gmail.com';
    }

    if (!clientId || !to || !subject || !message) {
      return NextResponse.json({ error: 'Client ID, to, subject and message are required' }, { status: 400 });
    }

    // Support multiple recipients: comma- or semicolon-separated
    const toAddresses = String(to)
      .split(/[,;]/)
      .map((e) => e.trim())
      .filter((e) => e && e.includes('@'));

    // Validate client belongs to tenant and optionally update email if missing
    const client = await prisma.client.findFirst({
      where: { id: clientId, tenantId: user.tenantId },
      select: { id: true, email: true, additionalEmails: true, name: true }
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const primaryTo = toAddresses[0] || String(to).trim();
    if (!client.email && primaryTo) {
      await prisma.client.update({ where: { id: clientId }, data: { email: primaryTo } });
    }

    // Fetch tenant branding if available
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      include: { settings: true }
    });

    const companyName = tenant?.name || 'InsightBooks';
    const logoUrl = tenant?.settings?.logoUrl || 'https://insightbooksafrica.com/_next/image?url=%2Flogo.png&w=256&q=75';
    const primaryColor = tenant?.settings?.primaryColor || '#4f46e5';
    const appUrl = 'https://insightbooksafrica.com/';

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; line-height:1.6; color:#111827;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;margin:0 auto;border-collapse:collapse;">
          <tr>
            <td style="padding:20px 16px;text-align:center;border-bottom:1px solid #e5e7eb;">
              <a href="${appUrl}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">
                <img src="${logoUrl}" alt="${companyName} Logo" style="height:40px;width:auto;border:0;" />
                <span style="font-size:18px;font-weight:700;color:${primaryColor};">${companyName}</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 16px;">
              <p style="margin:0 0 12px 0;">Dear ${client.name || 'Client'},</p>
              <div style="margin:0 0 16px 0;">${(message || '').replace(/\n/g, '<br/>')}</div>
              <p style="margin:16px 0 0 0;color:#6b7280;font-size:12px;">If you have questions, simply reply to this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px;text-align:center;border-top:1px solid #e5e7eb;background:#f9fafb;">
              <div style="font-size:12px;color:#6b7280;">
                Sent via <a href="${appUrl}" target="_blank" rel="noopener" style="color:${primaryColor};text-decoration:none;">InsightBooks</a>
              </div>
            </td>
          </tr>
        </table>
      </div>
    `;

    // Send email using transporter directly to avoid template requirement
    // Use tenant's business email if available
    const tenantEmail = tenant?.settings?.businessEmail || process.env.EMAIL_FROM || 'noreply@insightbooksafrica.com';
    const senderFrom = `"${companyName}" <${tenantEmail}>`;
    
    const transporter = createTransport();
    const recipients = toAddresses.length > 0 ? toAddresses : [String(to).trim()];
    await transporter.sendMail({
      from: senderFrom,
      replyTo: replyTo || tenantEmail,
      to: recipients,
      subject,
      html: emailHtml,
      attachments
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'CLIENT_EMAIL_SENT',
        entityType: 'CLIENT',
        entityId: clientId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({ to: recipients, subject })
      }
    });

    return NextResponse.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending client email:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}


