import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { sendEmail } from '@/lib/emailService';

// POST /api/admin/send-bulk-email - Send bulk emails to selected users
export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userIds, subject, message, template, priority, htmlContent, attachments = [] } = body;

    // Validate required fields
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'User IDs are required' },
        { status: 400 }
      );
    }

    if (!subject || (!message && !htmlContent)) {
      return NextResponse.json(
        { error: 'Subject and message are required' },
        { status: 400 }
      );
    }

    // Get users from database
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      include: {
        tenant: {
          select: {
            name: true
          }
        }
      }
    });

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'No valid users found' },
        { status: 400 }
      );
    }

    // Create email template based on type
    const emailTemplate = createEmailTemplate(template, {
      subject,
      message,
      priority,
      adminName: admin.name || 'System Administrator'
    });

    // Send emails to all users
    const emailPromises = users.map(async (user) => {
      try {
        await sendEmail({
          to: user.email,
          subject: subject,
          template: 'rich-email',
          htmlContent: htmlContent || message,
          attachments: attachments,
          data: {
            name: user.name || 'User',
            message: htmlContent || message,
            adminName: admin.name || 'System Administrator',
            tenantName: user.tenant?.name || 'Unknown Tenant',
            priority: priority || 'normal'
          }
        });

        // Log email sent
        try {
          await prisma.emailLog.create({
            data: {
              recipientEmail: user.email,
              recipientName: user.name || 'Unknown',
              subject: emailTemplate.subject,
              template: template || 'custom',
              priority: priority || 'normal',
              status: 'sent'
            }
          });
        } catch (logError) {
          console.error('Error logging email:', logError);
          // Continue execution even if logging fails
        }

        return { success: true, userId: user.id, email: user.email };
      } catch (error) {
        console.error(`Error sending email to ${user.email}:`, error);
        
        // Log email failure
        try {
          await prisma.emailLog.create({
            data: {
              recipientEmail: user.email,
              recipientName: user.name || 'Unknown',
              subject: emailTemplate.subject,
              template: template || 'custom',
              priority: priority || 'normal',
              status: 'failed',
              errorMessage: error.message
            }
          });
        } catch (logError) {
          console.error('Error logging email failure:', logError);
          // Continue execution even if logging fails
        }

        return { success: false, userId: user.id, email: user.email, error: error.message };
      }
    });

    // Wait for all emails to be processed
    const results = await Promise.all(emailPromises);
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Log bulk email activity (commented out due to foreign key constraint issues)
    // The AdminActivityLog model references User but we have Admin ID
    // This will be fixed in a future schema update
    console.log(`Bulk email sent by admin ${admin.name}: ${successful.length} successful, ${failed.length} failed`);

    return NextResponse.json({
      message: 'Bulk email processing completed',
      sentCount: successful.length,
      failedCount: failed.length,
      totalRecipients: userIds.length,
      results: {
        successful: successful.map(r => ({ userId: r.userId, email: r.email })),
        failed: failed.map(r => ({ userId: r.userId, email: r.email, error: r.error }))
      }
    });

  } catch (error) {
    console.error('Error sending bulk email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to create email template
function createEmailTemplate(template, data) {
  const baseTemplate = {
    subject: data.subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #1e40af; margin-top: 0;">${data.subject}</h2>
          <p style="color: #64748b; margin: 0;">From: ${data.adminName}</p>
        </div>
        
        <div style="background-color: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
          <div style="white-space: pre-wrap; line-height: 1.6; color: #374151;">
            ${data.message.replace(/\n/g, '<br>')}
          </div>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #f1f5f9; border-radius: 6px; border-left: 4px solid #3b82f6;">
          <p style="margin: 0; color: #475569; font-size: 14px;">
            <strong>Priority:</strong> ${data.priority.toUpperCase()}
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 14px; margin: 0;">
            This is an automated message from the InsightBooks platform.
          </p>
          <p style="color: #64748b; font-size: 12px; margin: 5px 0 0 0;">
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `
  };

  // Add template-specific styling
  switch (template) {
    case 'announcement':
      baseTemplate.html = baseTemplate.html.replace(
        'border-left: 4px solid #3b82f6;',
        'border-left: 4px solid #10b981;'
      );
      break;
    case 'maintenance':
      baseTemplate.html = baseTemplate.html.replace(
        'border-left: 4px solid #3b82f6;',
        'border-left: 4px solid #f59e0b;'
      );
      break;
    case 'update':
      baseTemplate.html = baseTemplate.html.replace(
        'border-left: 4px solid #3b82f6;',
        'border-left: 4px solid #8b5cf6;'
      );
      break;
  }

  return baseTemplate;
}
