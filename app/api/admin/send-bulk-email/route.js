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
    const { userIds, subject, message, template, priority, htmlContent, attachments = [], showPriority = false } = body;

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

    // Get users from database with tenant branding
    // Use pagination to handle large user lists
    const BATCH_SIZE = 100;
    let allUsers = [];
    let skip = 0;
    
    while (true) {
      const batch = await prisma.user.findMany({
        where: {
          id: { in: userIds }
        },
        skip: skip,
        take: BATCH_SIZE,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              primaryColor: true,
              secondaryColor: true,
              settings: {
                select: {
                  businessAddress: true,
                  businessCity: true,
                  businessEmail: true,
                  businessPhone: true,
                  emailFooter: true
                }
              }
            }
          }
        }
      });
      
      if (batch.length === 0) break;
      allUsers = allUsers.concat(batch);
      skip += BATCH_SIZE;
      
      // If we got fewer than BATCH_SIZE, we've reached the end
      if (batch.length < BATCH_SIZE) break;
    }

    if (allUsers.length === 0) {
      return NextResponse.json(
        { error: 'No valid users found' },
        { status: 400 }
      );
    }

    // Filter out users without valid email addresses
    const validUsers = allUsers.filter(user => {
      const email = user.email?.trim();
      return email && email.includes('@') && email.length > 3;
    });

    const invalidUsers = allUsers.filter(user => {
      const email = user.email?.trim();
      return !email || !email.includes('@') || email.length <= 3;
    });

    console.log(`Total users: ${allUsers.length}, Valid emails: ${validUsers.length}, Invalid emails: ${invalidUsers.length}`);

    if (validUsers.length === 0) {
      return NextResponse.json(
        { error: 'No users with valid email addresses found' },
        { status: 400 }
      );
    }

    // Get base URL for logo images
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Helper function to send email with retry
    const sendEmailWithRetry = async (user, retries = 2) => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const tenant = user.tenant;
          const companyName = tenant?.name || 'InsightBooks';
          
          // Add delay between retries
          if (attempt > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
          
          await sendEmail({
            to: user.email,
            subject: subject,
            template: 'rich-email',
            htmlContent: htmlContent || message,
            attachments: attachments || [],
            data: {
              name: user.name || 'User',
              message: htmlContent || message,
              adminName: admin.name || 'System Administrator',
              tenantName: companyName,
              priority: priority || 'normal',
              showPriority: showPriority,
              subject: subject,
              companyName: companyName,
              baseUrl: baseUrl
            }
          });

          // Log email sent
          try {
            await prisma.emailLog.create({
              data: {
                recipientEmail: user.email,
                recipientName: user.name || 'Unknown',
                subject: subject,
                template: template || 'custom',
                priority: priority || 'normal',
                status: 'sent',
                sentByAdmin: admin.id,
                tenantId: user.tenantId || null,
                sentAt: new Date()
              }
            });
          } catch (logError) {
            console.error(`Error logging email for ${user.email}:`, logError);
            // Continue execution even if logging fails
          }

          return { success: true, userId: user.id, email: user.email };
        } catch (error) {
          const isLastAttempt = attempt === retries;
          console.error(`Error sending email to ${user.email} (attempt ${attempt + 1}/${retries + 1}):`, error.message || error);
          
          if (isLastAttempt) {
            // Log email failure on final attempt
            try {
              await prisma.emailLog.create({
                data: {
                  recipientEmail: user.email,
                  recipientName: user.name || 'Unknown',
                  subject: subject,
                  template: template || 'custom',
                  priority: priority || 'normal',
                  status: 'failed',
                  errorMessage: error.message || String(error),
                  sentByAdmin: admin.id,
                  tenantId: user.tenantId || null
                }
              });
            } catch (logError) {
              console.error('Error logging email failure:', logError);
            }
            
            return { 
              success: false, 
              userId: user.id, 
              email: user.email, 
              error: error.message || String(error) 
            };
          }
          // Continue to retry
        }
      }
    };

    // Send emails in batches to avoid overwhelming the SMTP server
    const EMAIL_BATCH_SIZE = 10; // Send 10 emails at a time
    const emailResults = [];
    
    for (let i = 0; i < validUsers.length; i += EMAIL_BATCH_SIZE) {
      const batch = validUsers.slice(i, i + EMAIL_BATCH_SIZE);
      console.log(`Processing email batch ${Math.floor(i / EMAIL_BATCH_SIZE) + 1}/${Math.ceil(validUsers.length / EMAIL_BATCH_SIZE)} (${batch.length} emails)`);
      
      // Process batch with timeout
      const batchPromises = batch.map(user => 
        Promise.race([
          sendEmailWithRetry(user),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Email sending timeout after 30 seconds')), 30000)
          )
        ]).catch(error => ({
          success: false,
          userId: user.id,
          email: user.email,
          error: error.message || 'Timeout or unknown error'
        }))
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process batch results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          emailResults.push(result.value);
        } else {
          const user = batch[index];
          emailResults.push({
            success: false,
            userId: user?.id || 'unknown',
            email: user?.email || 'unknown',
            error: result.reason?.message || String(result.reason) || 'Unknown error'
          });
        }
      });
      
      // Add delay between batches to avoid rate limiting
      if (i + EMAIL_BATCH_SIZE < validUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between batches
      }
    }

    // Process results
    const results = emailResults;
    
    const successful = results.filter(r => r && r.success);
    const failed = results.filter(r => r && !r.success);
    
    // Add invalid email users to failed list
    invalidUsers.forEach(user => {
      failed.push({
        success: false,
        userId: user.id,
        email: user.email || 'No email',
        error: 'Invalid or missing email address'
      });
    });

    // Log bulk email activity
    console.log(`Bulk email sent by admin ${admin.name}: ${successful.length} successful, ${failed.length} failed out of ${userIds.length} total recipients`);

    return NextResponse.json({
      message: 'Bulk email processing completed',
      sentCount: successful.length,
      failedCount: failed.length,
      totalRecipients: userIds.length,
      validEmails: validUsers.length,
      invalidEmails: invalidUsers.length,
      results: {
        successful: successful.map(r => ({ userId: r.userId, email: r.email })),
        failed: failed.map(r => ({ userId: r.userId, email: r.email, error: r.error }))
      }
    });

  } catch (error) {
    console.error('Error sending bulk email:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message || String(error),
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
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
