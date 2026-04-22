// lib/email.js
import nodemailer from 'nodemailer';

// Ensure environment variables are loaded
import 'dotenv/config';

// Configure email transporter
const createTransporter = async () => {
  // Check if email environment variables are configured
  const hasEmailConfig = !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log(`Creating email transporter - hasEmailConfig: ${hasEmailConfig}, NODE_ENV: ${process.env.NODE_ENV}`);
  
  // Use Hostinger SMTP if email environment variables are set (regardless of NODE_ENV)
  if (hasEmailConfig) {
    console.log('✅ Using Hostinger SMTP configuration (email config detected):', {
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_SECURE === 'true',
      user: process.env.EMAIL_USER,
      from: process.env.EMAIL_FROM
    });
    
    // Create base configuration
    const config = {
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      // Add debug mode to see detailed connection logs
      debug: true,
      logger: true
    };

    // Special handling for Hostinger SMTP
    if (process.env.EMAIL_HOST === 'smtp.hostinger.com') {
      if (process.env.EMAIL_PORT === '465') {
        // SSL configuration
        config.port = 465;
        config.secure = true;
        config.requireTLS = false;
        config.ignoreTLS = true;
      } else {
        // TLS configuration (more reliable)
        config.port = 587;
        config.secure = false;
        config.requireTLS = true;
        config.ignoreTLS = false;
      }
      
      // Let Node use default TLS ciphers (SSLv3 is obsolete and breaks modern OpenSSL).
      config.tls = { rejectUnauthorized: true };
      
      // Try different authentication methods
      config.authMethod = 'PLAIN';
    }
    
    return nodemailer.createTransport(config);
  } 
  
  // Fallback to Ethereal Email if no email configuration is set
  console.log('⚠️  No email configuration found, falling back to Ethereal test account for development');
  console.log('   To use Hostinger SMTP, ensure EMAIL_HOST, EMAIL_USER, and EMAIL_PASSWORD are set in your environment');
  try {
    const testAccount = await nodemailer.createTestAccount();
    console.log('Ethereal test account created:', testAccount.user);
    
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
      debug: true
    });
  } catch (error) {
    console.error('Failed to create Ethereal test account:', error);
    throw error;
  }
};

/** Many SMTP servers (including Hostinger) reject `verify()` but still accept `sendMail()`. */
async function verifySmtpConnectionOptional(transporter, context) {
  try {
    await transporter.verify();
    console.log(`SMTP verify OK (${context})`);
  } catch (e) {
    console.warn(
      `SMTP verify() failed (${context}); attempting send anyway:`,
      e?.message || e
    );
  }
}

// Send OTP verification email
export async function sendOTPEmail(to, otp, name) {
  try {
    console.log(`Attempting to send OTP email to: ${to}`);
    
    const transporter = await createTransporter();

    await verifySmtpConnectionOptional(transporter, 'OTP email');

    const mailOptions = {
      from: process.env.EMAIL_FROM || `"InsightBooks" <${process.env.EMAIL_USER}>`,
      to,
      subject: 'Verify Your Email - InsightBooks',
      headers: {
        'X-Mailer': 'InsightBooks/1.0',
      },
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - InsightBooks</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">InsightBooks</h1>
              <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Business Management Platform</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Verify Your Email Address</h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hello ${name || 'there'},
              </p>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                Thank you for signing up with InsightBooks. To complete your registration and access your account, please verify your email address using the verification code below:
              </p>
              
              <!-- OTP Code -->
              <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 25px; text-align: center; border-radius: 12px; margin: 30px 0; border: 2px solid #d1d5db;">
                <h2 style="margin: 0; letter-spacing: 8px; color: #4338ca; font-size: 32px; font-weight: 700; font-family: 'Courier New', monospace;">${otp}</h2>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0 0 30px 0;">
                ⏰ This verification code will expire in <strong>10 minutes</strong>
              </p>
              
              <!-- Security Notice -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 30px 0; border-radius: 4px;">
                <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
                  🔒 <strong>Security Notice:</strong> If you didn't sign up for InsightBooks, please ignore this email. Never share this verification code with anyone.
                </p>
              </div>
              
              <!-- Action Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.APP_URL || 'https://insightbooksafrica.com'}/auth/login" 
                   style="display: inline-block; background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%); color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(67, 56, 202, 0.25);">
                  🚀 Access Your Account
                </a>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 25px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 15px 0;">
                © ${new Date().getFullYear()} InsightBooks. All rights reserved.
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0 0 10px 0;">
                This email was sent to ${to} because you signed up for InsightBooks.
              </p>
              <div style="margin-top: 15px;">
                <a href="mailto:support@insightbooksafrica.com" style="color: #6366f1; text-decoration: none; font-size: 12px; margin: 0 10px;">Support</a>
                <span style="color: #d1d5db;">|</span>
                <a href="mailto:unsubscribe@insightbooksafrica.com" style="color: #6366f1; text-decoration: none; font-size: 12px; margin: 0 10px;">Unsubscribe</a>
          </div>
          </div>
          </div>
        </body>
        </html>
      `,
      // Improved plain text version
      text: `Verify Your Email - InsightBooks

Hello ${name || 'there'},

Thank you for signing up with InsightBooks. To complete your registration and access your account, please verify your email address using the verification code below:

VERIFICATION CODE: ${otp}

This verification code will expire in 10 minutes.

Security Notice: If you didn't sign up for InsightBooks, please ignore this email. Never share this verification code with anyone.

Access your account: ${process.env.APP_URL || 'https://insightbooksafrica.com'}/auth/login

© ${new Date().getFullYear()} InsightBooks. All rights reserved.
This email was sent to ${to} because you signed up for InsightBooks.

Support: support@insightbooksafrica.com
Unsubscribe: unsubscribe@insightbooksafrica.com`
    };
    
    console.log('Sending email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });
    
    const info = await transporter.sendMail(mailOptions);

    console.log('Email sent successfully:', {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected
    });

    if (info.rejected?.length) {
      return {
        success: false,
        error: `SMTP rejected recipient(s): ${info.rejected.join(', ')}`,
        messageId: info.messageId,
      };
    }

    // If using ethereal for development, log the URL to view the email
    if (info.messageUrl) {
      console.log('Preview URL: %s', info.messageUrl);
    } else if (nodemailer.getTestMessageUrl && nodemailer.getTestMessageUrl(info)) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return { 
      success: false, 
      error: error.message,
      code: error.code,
      command: error.command
    };
  }
}

// Send daily report email
export async function sendDailyReportEmail(to, adminName, companyName, reportDate, htmlContent, textContent) {
  try {
    console.log(`Attempting to send daily report email to: ${to}`);
    
    const transporter = await createTransporter();

    await verifySmtpConnectionOptional(transporter, 'daily report');

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const mailOptions = {
      from: process.env.EMAIL_FROM || `"InsightBooks" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Daily Financial Report - ${companyName} - ${formatDate(reportDate)}`,
      html: htmlContent,
      text: textContent
    };
    
    console.log('Sending daily report email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Daily report email sent successfully:', {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected
    });
   
    // If using ethereal for development, log the URL to view the email
    if (info.messageUrl) {
      console.log('Preview URL: %s', info.messageUrl);
    } else if (nodemailer.getTestMessageUrl && nodemailer.getTestMessageUrl(info)) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
   
    return { 
      success: true, 
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected
    };
  } catch (error) {
    console.error('Error sending daily report email:', error);
    return { 
      success: false, 
      error: error.message,
      code: error.code,
      command: error.command
    };
  }
}

// Send subscription expiry reminder email
export async function sendSubscriptionExpiryReminderEmail(to, userName, companyName, daysRemaining, expiryDate, isTrial, plan, renewalUrl) {
  try {
    console.log(`Attempting to send subscription expiry reminder email to: ${to}, days remaining: ${daysRemaining}`);
    
    const transporter = await createTransporter();

    await verifySmtpConnectionOptional(transporter, 'subscription reminder');

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const isUrgent = daysRemaining === 1;
    const subscriptionType = isTrial ? 'Free Trial' : 'Subscription';
    const urgencyColor = isUrgent ? '#dc2626' : '#f59e0b';
    const urgencyBg = isUrgent ? '#fee2e2' : '#fef3c7';
    const urgencyBorder = isUrgent ? '#dc2626' : '#f59e0b';
    const urgencyIcon = isUrgent ? '🚨' : '⏰';
    
    // Enhanced messaging based on urgency
    const urgencyMessage = isUrgent 
      ? 'Your subscription expires TOMORROW! Act now to prevent service interruption and maintain uninterrupted access to all your business tools.'
      : 'Your subscription expires in 2 days. Renew today to ensure seamless continuity and avoid any disruption to your business operations.';
    
    const urgencyHeadline = isUrgent
      ? 'Action Required: Your Subscription Expires Tomorrow'
      : 'Friendly Reminder: Your Subscription Expires Soon';
    
    const ctaText = isUrgent
      ? '🚨 Renew Now - Don\'t Lose Access!'
      : '✨ Renew Subscription - Secure Your Access';
    
    const ctaSubtext = isUrgent
      ? 'Click below to renew immediately and avoid service interruption'
      : 'Renew now to continue enjoying all premium features';

    const subject = isUrgent
      ? `🚨 URGENT: ${subscriptionType} Expires Tomorrow - Action Required for ${companyName}`
      : `⏰ ${subscriptionType} Expiring in 2 Days - Renew Now for ${companyName}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15); overflow: hidden;">
          <!-- Header with Gradient and Pulse Effect -->
          <div style="background: linear-gradient(135deg, ${isUrgent ? '#dc2626' : '#f59e0b'} 0%, ${isUrgent ? '#b91c1c' : '#d97706'} 100%); padding: 45px 30px; text-align: center; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); animation: pulse 3s ease-in-out infinite;"></div>
            <div style="font-size: 56px; margin-bottom: 15px; position: relative; z-index: 1;">${urgencyIcon}</div>
            <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px; position: relative; z-index: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${urgencyHeadline}</h1>
            <p style="color: #ffffff; margin: 15px 0 0 0; font-size: 18px; opacity: 0.95; position: relative; z-index: 1; font-weight: 500;">${companyName}</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 45px 35px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 26px; font-weight: 700; line-height: 1.3;">Hello ${userName || 'Valued Customer'},</h2>
            
            <p style="color: #4b5563; font-size: 17px; line-height: 1.8; margin: 0 0 30px 0;">
              We hope this message finds you well. We wanted to bring to your attention that your <strong style="color: #1f2937;">${subscriptionType.toLowerCase()}</strong> for <strong style="color: #1f2937;">${companyName}</strong> is approaching its expiration date.
            </p>

            <!-- Urgency Alert Box with Enhanced Design -->
            <div style="background: linear-gradient(135deg, ${urgencyBg} 0%, ${isUrgent ? '#fecaca' : '#fde68a'} 100%); border: 3px solid ${urgencyBorder}; padding: 25px; margin: 35px 0; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <div style="display: flex; align-items: flex-start; gap: 15px;">
                <div style="font-size: 32px; line-height: 1;">${urgencyIcon}</div>
                <div style="flex: 1;">
                  <p style="color: ${urgencyColor}; font-size: 18px; font-weight: 700; margin: 0 0 12px 0; line-height: 1.4;">
                    ${urgencyMessage}
                  </p>
                  <div style="background-color: rgba(255,255,255,0.7); padding: 15px; border-radius: 8px; margin-top: 15px;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 6px 0; color: ${urgencyColor}; font-size: 15px; font-weight: 600;">Expiry Date:</td>
                        <td style="padding: 6px 0; color: ${urgencyColor}; font-size: 15px; font-weight: 700; text-align: right;">${formatDate(expiryDate)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: ${urgencyColor}; font-size: 15px; font-weight: 600;">Time Remaining:</td>
                        <td style="padding: 6px 0; color: ${urgencyColor}; font-size: 15px; font-weight: 700; text-align: right;">${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</td>
                      </tr>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <!-- What Happens If You Don't Renew -->
            <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-left: 4px solid #dc2626; padding: 22px; margin: 30px 0; border-radius: 8px;">
              <h3 style="color: #991b1b; margin: 0 0 12px 0; font-size: 18px; font-weight: 700;">⚠️ What Happens If You Don't Renew?</h3>
              <ul style="color: #7f1d1d; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 22px;">
                <li style="margin-bottom: 8px;">You'll lose access to all premium features and data</li>
                <li style="margin-bottom: 8px;">Your business operations may be interrupted</li>
                <li style="margin-bottom: 8px;">You'll need to set up your account again after renewal</li>
                <li>Potential loss of historical data and reports</li>
              </ul>
            </div>

            <!-- Subscription Details Card -->
            <div style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border-radius: 10px; padding: 25px; margin: 30px 0; border: 1px solid #e5e7eb;">
              <h3 style="color: #1f2937; margin: 0 0 18px 0; font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">📋</span> Your Subscription Details
              </h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-size: 15px; border-bottom: 1px solid #e5e7eb;">Plan:</td>
                  <td style="padding: 10px 0; color: #1f2937; font-size: 15px; font-weight: 700; text-align: right; border-bottom: 1px solid #e5e7eb;">${plan || 'Premium'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-size: 15px; border-bottom: 1px solid #e5e7eb;">Type:</td>
                  <td style="padding: 10px 0; color: #1f2937; font-size: 15px; font-weight: 700; text-align: right; border-bottom: 1px solid #e5e7eb;">${subscriptionType}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-size: 15px;">Expires:</td>
                  <td style="padding: 10px 0; color: #1f2937; font-size: 15px; font-weight: 700; text-align: right;">${formatDate(expiryDate)}</td>
                </tr>
              </table>
            </div>

            <!-- Benefits Reminder with Icons -->
            <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 10px; padding: 25px; margin: 30px 0; border: 2px solid #3b82f6;">
              <h3 style="color: #1e40af; margin: 0 0 18px 0; font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">✨</span> Continue Enjoying These Premium Benefits
              </h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 20px;">📄</span>
                  <span style="color: #1e3a8a; font-size: 14px; font-weight: 500;">Unlimited Documents</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 20px;">📊</span>
                  <span style="color: #1e3a8a; font-size: 14px; font-weight: 500;">Advanced Analytics</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 20px;">📦</span>
                  <span style="color: #1e3a8a; font-size: 14px; font-weight: 500;">Stock Management</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 20px;">👥</span>
                  <span style="color: #1e3a8a; font-size: 14px; font-weight: 500;">Multi-User Access</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 20px;">🔒</span>
                  <span style="color: #1e3a8a; font-size: 14px; font-weight: 500;">Secure Data Storage</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 20px;">💬</span>
                  <span style="color: #1e3a8a; font-size: 14px; font-weight: 500;">Priority Support</span>
                </div>
              </div>
            </div>

            <!-- Primary CTA Button -->
            <div style="text-align: center; margin: 45px 0 25px 0;">
              <a href="${renewalUrl || `${process.env.APP_URL || 'https://insightbooksafrica.com'}/subscription`}" 
                 style="display: inline-block; background: linear-gradient(135deg, ${isUrgent ? '#dc2626' : '#f59e0b'} 0%, ${isUrgent ? '#b91c1c' : '#d97706'} 100%); color: #ffffff; padding: 20px 50px; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 20px; box-shadow: 0 10px 25px rgba(${isUrgent ? '220, 38, 38' : '245, 158, 11'}, 0.5); text-transform: uppercase; letter-spacing: 0.5px;">
                ${ctaText}
              </a>
              <p style="color: #6b7280; font-size: 14px; margin: 15px 0 0 0; font-weight: 500;">
                ${ctaSubtext}
              </p>
            </div>

            <!-- Trust Indicators -->
            <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px; margin: 30px 0; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                <span style="font-size: 24px;">✅</span>
                <p style="color: #166534; font-size: 15px; font-weight: 600; margin: 0;">Quick & Secure Renewal Process</p>
              </div>
              <p style="color: #15803d; font-size: 14px; line-height: 1.6; margin: 0;">
                Renewing takes less than 2 minutes. Your payment is processed securely, and your subscription will be activated immediately.
              </p>
            </div>

            <!-- Help Section -->
            <div style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border-radius: 8px; padding: 22px; margin: 30px 0;">
              <h3 style="color: #334155; margin: 0 0 12px 0; font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">💡</span> Need Assistance?
              </h3>
              <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 12px 0;">
                Our dedicated support team is standing by to help you with any questions about renewing your subscription, payment options, or account management.
              </p>
              <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0;">
                📧 Email us at <a href="mailto:support@insightbooksafrica.com" style="color: #6366f1; text-decoration: none; font-weight: 600;">support@insightbooksafrica.com</a> or visit our help center.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 35px; text-align: center; border-top: 2px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 15px; margin: 0 0 18px 0; font-weight: 500;">
              © ${new Date().getFullYear()} InsightBooks. All rights reserved.
            </p>
            <p style="color: #9ca3af; font-size: 13px; margin: 0 0 20px 0; line-height: 1.6;">
              This email was sent to ${to} because your ${subscriptionType.toLowerCase()} for ${companyName} is expiring soon. 
              ${isUrgent ? 'Please renew immediately to avoid service interruption.' : 'We recommend renewing early to ensure uninterrupted access.'}
            </p>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <a href="mailto:support@insightbooksafrica.com" style="color: #6366f1; text-decoration: none; font-size: 13px; margin: 0 12px; font-weight: 500;">Support</a>
              <span style="color: #d1d5db;">|</span>
              <a href="${process.env.APP_URL || 'https://insightbooksafrica.com'}/subscription" style="color: #6366f1; text-decoration: none; font-size: 13px; margin: 0 12px; font-weight: 500;">Manage Subscription</a>
              <span style="color: #d1d5db;">|</span>
              <a href="${process.env.APP_URL || 'https://insightbooksafrica.com'}" style="color: #6366f1; text-decoration: none; font-size: 13px; margin: 0 12px; font-weight: 500;">Visit Website</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `${subject}

Hello ${userName || 'Valued Customer'},

We hope this message finds you well. We wanted to bring to your attention that your ${subscriptionType.toLowerCase()} for ${companyName} is approaching its expiration date.

${urgencyMessage}

EXPIRY DETAILS:
- Expiry Date: ${formatDate(expiryDate)}
- Time Remaining: ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}

SUBSCRIPTION DETAILS:
- Plan: ${plan || 'Premium'}
- Type: ${subscriptionType}
- Expires: ${formatDate(expiryDate)}

⚠️ WHAT HAPPENS IF YOU DON'T RENEW?
- You'll lose access to all premium features and data
- Your business operations may be interrupted
- You'll need to set up your account again after renewal
- Potential loss of historical data and reports

✨ CONTINUE ENJOYING THESE PREMIUM BENEFITS:
- Unlimited Documents (invoices, quotations, receipts)
- Advanced Analytics & Reporting
- Stock Management & Tracking
- Customer & Supplier Management
- Multi-User Access & Permissions
- Secure Data Storage
- Priority Customer Support

${ctaText}
${ctaSubtext}

Renew your subscription now: ${renewalUrl || `${process.env.APP_URL || 'https://insightbooksafrica.com'}/subscription`}

✅ QUICK & SECURE RENEWAL PROCESS
Renewing takes less than 2 minutes. Your payment is processed securely, and your subscription will be activated immediately.

💡 NEED ASSISTANCE?
Our dedicated support team is standing by to help you with any questions about renewing your subscription, payment options, or account management.

📧 Email us at support@insightbooksafrica.com or visit our help center.

© ${new Date().getFullYear()} InsightBooks. All rights reserved.
This email was sent to ${to} because your ${subscriptionType.toLowerCase()} for ${companyName} is expiring soon. ${isUrgent ? 'Please renew immediately to avoid service interruption.' : 'We recommend renewing early to ensure uninterrupted access.'}

Support: support@insightbooksafrica.com
Manage Subscription: ${process.env.APP_URL || 'https://insightbooksafrica.com'}/subscription
Visit Website: ${process.env.APP_URL || 'https://insightbooksafrica.com'}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM || `"InsightBooks" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
      text: textContent,
      headers: {
        'X-Priority': isUrgent ? '1' : '3',
        'X-MSMail-Priority': isUrgent ? 'High' : 'Normal',
        'Importance': isUrgent ? 'high' : 'normal',
        'X-Mailer': 'InsightBooks/1.0',
        'X-Report-Abuse': 'Please report abuse here: abuse@insightbooksafrica.com',
        'List-Unsubscribe': '<mailto:unsubscribe@insightbooksafrica.com>',
        'Precedence': 'bulk'
      }
    };
    
    console.log('Sending subscription expiry reminder email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      daysRemaining
    });
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Subscription expiry reminder email sent successfully:', {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected
    });
   
    // If using ethereal for development, log the URL to view the email
    if (info.messageUrl) {
      console.log('Preview URL: %s', info.messageUrl);
    } else if (nodemailer.getTestMessageUrl && nodemailer.getTestMessageUrl(info)) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
   
    return { 
      success: true, 
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected
    };
  } catch (error) {
    console.error('Error sending subscription expiry reminder email:', error);
    return { 
      success: false, 
      error: error.message,
      code: error.code,
      command: error.command
    };
  }
}