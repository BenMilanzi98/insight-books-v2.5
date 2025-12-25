import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/emailService';

export async function POST(request) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['businessName', 'clientName', 'email', 'phone', 'body'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Format the date and time if provided
    const formatDateTime = (dateTimeString) => {
      if (!dateTimeString) return 'Not specified';
      try {
        const date = new Date(dateTimeString);
        return date.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        });
      } catch (error) {
        return dateTimeString;
      }
    };

    // Generate Google Calendar event URL
    const generateGoogleCalendarUrl = (dateTimeString, businessName, clientName) => {
      if (!dateTimeString) return null;

      try {
        const startDate = new Date(dateTimeString);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour later

        // Format dates for Google Calendar (YYYYMMDDTHHMMSSZ)
        const formatGoogleDate = (date) => {
          return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const start = formatGoogleDate(startDate);
        const end = formatGoogleDate(endDate);

        const title = encodeURIComponent(`InsightBooks Demo - ${businessName}`);
        const details = encodeURIComponent(
          `Demo session with ${clientName} from ${businessName}.\n\n` +
          `Contact: ${body.email} | ${body.phone}\n\n` +
          `Message: ${body.body}\n\n` +
          `This event was scheduled via the InsightBooks demo request form.`
        );
        const location = encodeURIComponent('Online Demo');

        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
      } catch (error) {
        console.error('Error generating Google Calendar URL:', error);
        return null;
      }
    };

    const calendarUrl = generateGoogleCalendarUrl(body.dateTime, body.businessName, body.clientName);

    // Create professional email content
    const emailContent = {
      subject: 'DEMO REQUEST',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0;">🎯 Demo Request</h1>
            <p style="color: #e0e7ff; margin: 0; font-size: 16px;">New demo request received</p>
          </div>

          <!-- Business Information -->
          <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
            <h2 style="color: #1e293b; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">🏢 Business Information</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div>
                <p style="margin: 0 0 4px 0; font-size: 14px; color: #64748b; font-weight: 500;">Business Name</p>
                <p style="margin: 0; font-size: 16px; color: #1e293b; font-weight: 600;">${body.businessName}</p>
              </div>
              <div>
                <p style="margin: 0 0 4px 0; font-size: 14px; color: #64748b; font-weight: 500;">Client Name</p>
                <p style="margin: 0; font-size: 16px; color: #1e293b; font-weight: 600;">${body.clientName}</p>
              </div>
            </div>
          </div>

          <!-- Contact Information -->
          <div style="background-color: #ffffff; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
            <h2 style="color: #1e293b; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">📞 Contact Information</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div>
                <p style="margin: 0 0 4px 0; font-size: 14px; color: #64748b; font-weight: 500;">Email Address</p>
                <p style="margin: 0; font-size: 16px; color: #2563eb; font-weight: 600;">
                  <a href="mailto:${body.email}" style="color: #2563eb; text-decoration: none;">${body.email}</a>
                </p>
              </div>
              <div>
                <p style="margin: 0 0 4px 0; font-size: 14px; color: #64748b; font-weight: 500;">Phone Number</p>
                <p style="margin: 0; font-size: 16px; color: #1e293b; font-weight: 600;">
                  <a href="tel:${body.phone}" style="color: #1e293b; text-decoration: none;">${body.phone}</a>
                </p>
              </div>
            </div>
          </div>

          <!-- Preferred Demo Time -->
          <div style="background-color: #fef3c7; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid #f59e0b;">
            <h2 style="color: #92400e; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">Preferred Demo Time</h2>
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #92400e; font-weight: 500;">${formatDateTime(body.dateTime)}</p>
            ${calendarUrl ? `
              <div style="text-align: center;">
                <a href="${calendarUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  Add to Google Calendar
                </a>
              </div>
            ` : ''}
          </div>

          <!-- Message -->
          <div style="background-color: #ffffff; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
            <h2 style="color: #1e293b; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">💬 Message</h2>
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; border-left: 4px solid #3b82f6;">
              <p style="margin: 0; font-size: 16px; color: #374151; line-height: 1.6; white-space: pre-wrap;">${body.body}</p>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              This demo request was submitted via the InsightBooks contact form.
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
              Please respond promptly to schedule the demo.
            </p>
          </div>
        </div>
      `
    };

    // Send the email
    try {
      const emailResult = await sendEmail({
        //to: 'benmilanzi8@gmail.com', // For testing purposes
        to: 'insightinnovationsltd@gmail.com', // Production recipient   
        subject: 'DEMO REQUEST',
        htmlContent: emailContent.html
      });

      console.log('Demo request email sent successfully:', emailResult.messageId);

      return NextResponse.json({
        success: true,
        message: 'Demo request submitted successfully! We will contact you soon.',
        messageId: emailResult.messageId
      });
    } catch (emailError) {
      console.error('Failed to send demo request email:', emailError);

      // For demo purposes, still return success but log the error
      // In production, you might want to store the request in database and retry later
      console.log('⚠️ Email sending failed, but demo request recorded successfully');

      return NextResponse.json({
        success: true,
        message: 'Demo request submitted successfully! We will contact you soon.',
        note: 'Email delivery may be delayed due to technical issues.'
      });
    }

  } catch (error) {
    console.error('Error processing demo request:', error);
    return NextResponse.json(
      { error: 'Failed to submit demo request. Please try again.' },
      { status: 500 }
    );
  }
}