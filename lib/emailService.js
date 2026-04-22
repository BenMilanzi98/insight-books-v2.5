// lib/emailService.js
// Email service for sending various types of emails

/**
 * Configure your email provider here. Examples:
 * - SendGrid
 * - Mailgun
 * - AWS SES
 * - SMTP service
 */

// Import your email service library
// Example using nodemailer with SMTP
import nodemailer from 'nodemailer';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getPublicAppBaseUrlForEmail } from '@/lib/publicAppUrl';

// Email templates
const templates = {
  'welcome-email': (data) => ({
    subject: `Welcome to ${process.env.COMPANY_NAME || 'Insight Books'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome, ${data.name}!</h2>
        <p>Thank you for joining our platform. Your account has been created successfully.</p>
        <p>Here are your login details:</p>
        <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0;">
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Password:</strong> ${data.password}</p>
        </div>
        <p>You can access your account at: <a href="${data.loginUrl}">${data.loginUrl}</a></p>
        <p>For security reasons, we recommend changing your password after your first login.</p>
        <p>If you need any assistance, please contact our support team.</p>
        <p>Best regards,<br>The Team</p>
      </div>
    `
  }),
  
  'affiliate-welcome': (data) => ({
    subject: `Welcome to InsightBooks Affiliate Program - ${data.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">🎉 Welcome to InsightBooks Affiliate Program!</h1>
        </div>
        
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
          <h2 style="color: #1e293b; margin-top: 0;">Hello ${data.name},</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #475569;">
            Welcome to the InsightBooks Affiliate Program! We're excited to have you on board as a partner.
          </p>
        </div>

        <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin-bottom: 25px;">
          <h3 style="color: #1e40af; margin-top: 0;">🚀 Your Affiliate Account Details</h3>
          <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 8px 0;"><strong>Email:</strong> ${data.email}</p>
            <p style="margin: 8px 0;"><strong>Temporary Password:</strong> <span style="background-color: #fef3c7; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${data.password}</span></p>
            <p style="margin: 8px 0;"><strong>Referral Code:</strong> <span style="background-color: #dbeafe; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${data.referralCode}</span></p>
            <p style="margin: 8px 0;"><strong>Commission Rate:</strong> ${data.commissionRate}%</p>
          </div>
        </div>

        <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px; margin-bottom: 25px;">
          <h3 style="color: #15803d; margin-top: 0;">🔑 How to Access Your Account</h3>
          <p style="color: #166534; margin-bottom: 15px;">
            Click the button below to access your affiliate dashboard:
          </p>
          <div style="text-align: center;">
            <a href="${data.loginUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              🚀 Access Affiliate Dashboard
            </a>
          </div>
          <p style="font-size: 14px; color: #166534; margin-top: 15px; text-align: center;">
            Or copy this link: <a href="${data.loginUrl}" style="color: #2563eb;">${data.loginUrl}</a>
          </p>
        </div>

        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 25px;">
          <h3 style="color: #d97706; margin-top: 0;">⚠️ Important Security Notice</h3>
          <p style="color: #92400e;">
            <strong>For your security:</strong>
          </p>
          <ul style="color: #92400e;">
            <li>Change your password immediately after your first login</li>
            <li>Keep your referral code confidential</li>
            <li>Never share your login credentials</li>
          </ul>
        </div>

        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
          <h3 style="color: #334155; margin-top: 0;">💡 Getting Started</h3>
          <ol style="color: #475569;">
            <li>Login to your affiliate dashboard using the credentials above</li>
            <li>Change your password to something secure</li>
            <li>Start sharing your referral code with potential customers</li>
            <li>Track your referrals and earnings in the dashboard</li>
            <li>Request payouts when you reach the minimum threshold</li>
          </ol>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; margin-bottom: 10px;">
            Need help? Contact our support team at 
            <a href="mailto:support@insightbooksafrica.com" style="color: #2563eb;">support@insightbooksafrica.com</a>
          </p>
          <p style="color: #64748b; font-size: 14px;">
            Best regards,<br>
            <strong>The InsightBooks Team</strong>
          </p>
        </div>
      </div>
    `
  }),

  'password-reset-link': (data) => ({
    subject: `Password Reset Request - ${process.env.COMPANY_NAME || 'Insight Books'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #dc2626; margin: 0;">🔐 Password Reset Request</h1>
        </div>
        
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
          <h2 style="color: #1e293b; margin-top: 0;">Hello ${data.name},</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #475569;">
            We received a request to reset your password for your Insight Books account.
          </p>
        </div>

        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 25px;">
          <h3 style="color: #991b1b; margin-top: 0;">⚠️ Important Security Notice</h3>
          <p style="color: #7f1d1d;">
            If you didn't request this password reset, please ignore this email. Your account remains secure.
          </p>
        </div>

        <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin-bottom: 25px;">
          <h3 style="color: #1e40af; margin-top: 0;">🔑 Reset Your Password</h3>
          <p style="color: #166534; margin-bottom: 15px;">
            Click the button below to reset your password:
          </p>
          <div style="text-align: center;">
            <a href="${data.resetLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              🔐 Reset Password
            </a>
          </div>
          <p style="font-size: 14px; color: #166534; margin-top: 15px; text-align: center;">
            Or copy this link: <a href="${data.resetLink}" style="color: #2563eb;">${data.resetLink}</a>
          </p>
        </div>

        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 25px;">
          <h3 style="color: #d97706; margin-top: 0;">⏰ Link Expiry</h3>
          <p style="color: #92400e;">
            This password reset link will expire in <strong>1 hour</strong> for security reasons.
          </p>
        </div>

        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
          <h3 style="color: #334155; margin-top: 0;">💡 Need Help?</h3>
          <p style="color: #475569;">
            If you have any questions or need assistance, please contact our support team.
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 14px;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      </div>
    `
  }),
  
  'password-reset': (data) => ({
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>Hello ${data.name},</p>
        <p>We received a request to reset your password. Use the following code to complete the process:</p>
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${data.otp}
        </div>
        <p>This code will expire in ${data.expiryHours} hour(s).</p>
        <p>If you didn't request this reset, please ignore this email or contact support if you have concerns.</p>
        <p>Best regards,<br>The Team</p>
      </div>
    `
  }),

  'custom-email': (data) => ({
    subject: data.subject || 'Message from InsightBooks',
    html: data.message || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #1e40af; margin-top: 0;">${data.subject || 'Message from InsightBooks'}</h2>
          <p style="color: #64748b; margin: 0;">From: ${data.adminName || 'System Administrator'}</p>
        </div>
        
        <div style="background-color: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
          <div style="white-space: pre-wrap; line-height: 1.6; color: #374151;">
            ${data.message || 'No message content provided.'}
          </div>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #f1f5f9; border-radius: 6px; border-left: 4px solid #3b82f6;">
          <p style="margin: 0; color: #475569; font-size: 14px;">
            <strong>Priority:</strong> ${data.priority || 'NORMAL'}
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
  }),

  'rich-email': (data) => {
    // Use logo colors: dark blue (#1e40af) and bright blue (#3b82f6)
    const primaryColor = '#1e40af'; // Dark blue from logo
    const secondaryColor = '#3b82f6'; // Bright blue from logo
    const companyName = data.companyName || data.tenantName || 'InsightBooks';
    
    // Use tenant logo if available, otherwise fall back to default logo or tenant name
    const baseUrl = data.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const tenantLogoUrl = data.tenantLogoUrl;
    let logoUrl = null;
    let showLogo = false;
    let showTenantName = false;
    
    if (tenantLogoUrl && tenantLogoUrl.trim() !== '') {
      // If tenant logo is a full URL, use it directly; otherwise construct the full URL
      if (tenantLogoUrl.startsWith('http://') || tenantLogoUrl.startsWith('https://')) {
        logoUrl = tenantLogoUrl;
      } else if (tenantLogoUrl.startsWith('/')) {
        logoUrl = `${baseUrl}${tenantLogoUrl}`;
      } else {
        logoUrl = `${baseUrl}/${tenantLogoUrl}`;
      }
      showLogo = true;
    } else {
      // No tenant logo, show tenant name instead
      showTenantName = true;
    }
    
    // Helper function to lighten/darken colors for gradients
    const lightenColor = (color, percent) => {
      const num = parseInt(color.replace("#", ""), 16);
      const amt = Math.round(2.55 * percent);
      const R = Math.min(255, (num >> 16) + amt);
      const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
      const B = Math.min(255, (num & 0x0000FF) + amt);
      return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    };
    
    const lightPrimary = lightenColor(primaryColor, 20);
    const darkPrimary = lightenColor(primaryColor, -15);
    
    // Use HTML content directly from the WYSIWYG editor
    const getEmailContent = () => {
      const content = data.htmlContent || data.message;
      if (!content) return 'No message content provided.';
      
      // If it's already HTML, return it with enhanced styling
      if (content.includes('<')) {
        // Enhance the HTML content with proper email styling
        return content
          .replace(/<h1[^>]*>/g, `<h1 style="font-size: 24px; font-weight: 700; margin: 16px 0 8px 0; line-height: 1.2; color: ${primaryColor};">`)
          .replace(/<h2[^>]*>/g, `<h2 style="font-size: 20px; font-weight: 700; margin: 20px 0 10px 0; line-height: 1.3; color: ${primaryColor};">`)
          .replace(/<h3[^>]*>/g, `<h3 style="font-size: 18px; font-weight: 600; margin: 16px 0 8px 0; line-height: 1.4; color: ${darkPrimary};">`)
          .replace(/<ul[^>]*>/g, '<ul style="margin: 16px 0; padding-left: 20px;">')
          .replace(/<li[^>]*>/g, '<li style="margin: 4px 0; color: #374151; line-height: 1.6;">')
          .replace(/<blockquote[^>]*>/g, `<blockquote style="border-left: 4px solid ${primaryColor}; padding-left: 16px; margin: 16px 0; color: #6b7280; font-style: italic; background-color: #f9fafb;">`)
          .replace(/<strong[^>]*>/g, '<strong style="font-weight: 700; color: #111827;">')
          .replace(/<em[^>]*>/g, '<em style="font-style: italic; color: #374151;">')
          .replace(/<u[^>]*>/g, '<u style="text-decoration: underline;">')
          .replace(/<img([^>]*)>/g, '<img$1 style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin: 16px 0; display: block; margin-left: auto; margin-right: auto;">');
      }
      
      // Otherwise, wrap in paragraph
      return `<p style="margin: 12px 0; color: #374151; line-height: 1.6;">${content}</p>`;
    };

    // Get priority badge color
    const getPriorityColor = (priority) => {
      switch (priority?.toLowerCase()) {
        case 'urgent':
          return { bg: '#fef2f2', border: '#ef4444', text: '#dc2626' };
        case 'high':
          return { bg: '#fff7ed', border: '#f97316', text: '#ea580c' };
        case 'low':
          return { bg: '#f9fafb', border: '#9ca3af', text: '#6b7280' };
        default:
          return { bg: '#eff6ff', border: primaryColor, text: darkPrimary };
      }
    };
    
    const priorityColors = getPriorityColor(data.priority);

    return {
      subject: data.subject || `Message from ${companyName}`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${data.subject || `Message from ${companyName}`}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <!-- Wrapper Table -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
    <tr>
      <td align="center" style="padding: 0;">
        <!-- Main Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with Logo or Tenant Name -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 24px; text-align: center; border-bottom: 2px solid #e5e7eb;">
              ${showLogo ? `
                <img src="${logoUrl}" alt="${companyName}" style="max-height: 80px; max-width: 250px; height: auto; width: auto; display: block; margin: 0 auto;" />
              ` : `
                <h1 style="margin: 0; color: ${primaryColor}; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                  ${companyName}
                </h1>
              `}
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 24px 24px 24px; background-color: #ffffff;">
              <div style="line-height: 1.7; color: #374151; font-size: 15px;">
                ${getEmailContent()}
              </div>
            </td>
          </tr>
          
          <!-- Priority Badge (only shown if showPriority is true) -->
          ${data.showPriority && data.priority ? `
          <tr>
            <td style="padding: 0 24px 24px 24px; background-color: #ffffff;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding: 12px 16px; background-color: ${priorityColors.bg}; border-left: 4px solid ${priorityColors.border}; border-radius: 6px;">
                    <p style="margin: 0; color: ${priorityColors.text}; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                      Priority: ${(data.priority || 'NORMAL').toUpperCase()}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 24px; background-color: #f9fafb; border-top: 2px solid #e5e7eb;">
              <div style="text-align: center;">
                <p style="margin: 0; color: ${primaryColor}; font-size: 16px; font-weight: 600;">
                  <a href="https://www.insightbooksafrica.com" style="color: ${primaryColor}; text-decoration: none;">www.insightbooksafrica.com</a>
                </p>
              </div>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    };
  },

  'payslip-email': (data) => {
    const primaryColor = '#1e40af';
    const secondaryColor = '#3b82f6';
    const companyName = data.companyName || data.tenantName || 'InsightBooks';
    const baseUrl = data.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const tenantLogoUrl = data.tenantLogoUrl;
    
    let headerContent;
    if (tenantLogoUrl && tenantLogoUrl.trim() !== '') {
      const fullLogoUrl = tenantLogoUrl.startsWith('http') ? tenantLogoUrl : `${baseUrl}${tenantLogoUrl}`;
      headerContent = `<img src="${fullLogoUrl}" alt="${companyName}" style="max-height: 80px; max-width: 250px; height: auto; width: auto; display: block; margin: 0 auto;" />`;
    } else {
      headerContent = `<h1 style="color: ${primaryColor}; margin: 0; font-size: 28px; font-weight: 700;">${companyName}</h1>`;
    }

    return {
      subject: data.subject || `Your Payslip for ${data.month} ${data.year} - ${companyName}`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payslip - ${data.month} ${data.year}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
    <tr>
      <td align="center" style="padding: 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 24px; text-align: center; border-bottom: 2px solid #e5e7eb;">
              ${headerContent}
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px; background-color: #ffffff;">
              <h2 style="color: ${primaryColor}; margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">Payslip Notification</h2>
              <p style="color: #6b7280; margin: 0 0 24px 0; font-size: 14px;">${data.month} ${data.year}</p>
              
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid ${primaryColor};">
                <p style="margin: 0 0 12px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                  Dear <strong>${data.employeeName}</strong>,
                </p>
                <p style="margin: 0 0 12px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                  Your payslip for <strong>${data.month} ${data.year}</strong> is attached to this email.
                </p>
                <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
                  Pay Period: <strong>${data.periodStart}</strong> to <strong>${data.periodEnd}</strong>
                </p>
              </div>
              
              <!-- Summary Box -->
              <div style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); border-radius: 8px; padding: 24px; margin: 24px 0; color: white;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="margin: 0; font-size: 13px; opacity: 0.9;">Gross Pay</p>
                      <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 700;">${data.grossPay}</p>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <p style="margin: 0; font-size: 13px; opacity: 0.9;">Total Deductions</p>
                      <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 700;">${data.totalDeductions}</p>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding: 16px 0 0 0; border-top: 2px solid rgba(255, 255, 255, 0.3);">
                      <p style="margin: 0; font-size: 13px; opacity: 0.9;">Net Pay</p>
                      <p style="margin: 4px 0 0 0; font-size: 28px; font-weight: 700;">${data.netPay}</p>
                    </td>
                  </tr>
                </table>
              </div>
              
              <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Please find your detailed payslip attached as a PDF document. If you have any questions or concerns regarding your payslip, please contact the HR department.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #f9fafb; border-top: 2px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                This is an automated message from ${companyName}. Please do not reply to this email.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    };
  }
};

// Create email transport
export const createTransport = () => {
  // Validate required environment variables
  const requiredEnvVars = ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASSWORD'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required email environment variables: ${missingVars.join(', ')}`);
  }

  // For development/testing, use a test account from Ethereal
  if (process.env.NODE_ENV !== 'production') {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }
  

  // Production email configuration
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
    // Try multiple configurations for Hostinger
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
    
    config.tls = { rejectUnauthorized: true };
    
    // Try different authentication methods
    config.authMethod = 'PLAIN';
  }

  console.log('Email transport config:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTLS,
    user: config.auth.user,
    // Don't log password for security
  });

  return nodemailer.createTransport(config);
};

/**
 * Send an email using a template
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Optional subject (will use template default if not provided)
 * @param {string} options.template - Template name to use
 * @param {Object} options.data - Data to populate the template
 * @param {string} options.from - Optional sender email (will use default if not provided)
 * @param {string} [options.text] - Plain-text body (recommended with htmlContent for deliverability)
 * @returns {Promise<Object>} Delivery result
 */
export const sendEmail = async ({
  to,
  subject,
  template,
  data,
  from,
  attachments = [],
  htmlContent = null,
  text = null,
}) => {
  try {
    const toAddress = typeof to === 'string' ? to.trim() : to;
    if (!toAddress) {
      throw new Error('Recipient email is required');
    }

    let finalSubject = subject;
    let finalHtml = htmlContent;

    // If template is provided, use it (even if htmlContent is also provided)
    // The template will use htmlContent from data if available
    if (template && templates[template]) {
      // Merge htmlContent into data if provided
      const templateData = {
        ...data,
        htmlContent: htmlContent || data.htmlContent || data.message
      };
      
      // Get the template content
      const templateContent = templates[template](templateData);
      finalHtml = templateContent.html;
      finalSubject = subject || templateContent.subject;
    } else if (htmlContent) {
      // If no template but htmlContent is provided, use it directly
      finalHtml = htmlContent;
    } else {
      throw new Error('Either template or htmlContent must be provided');
    }
    
    // Create transport
    const transporter = createTransport();

    // Verify connection configuration (optional, for debugging)
    try {
      await transporter.verify();
      console.log('SMTP connection verified successfully');
    } catch (verifyError) {
      console.warn('SMTP verification failed:', verifyError.message);
      // Continue anyway for demo requests
    }

    // Prepare email options
    const mailOptions = {
      from: from || process.env.EMAIL_FROM || '"Company Name" <noreply@example.com>',
      to: toAddress,
      subject: finalSubject,
      html: finalHtml,
      ...(text ? { text } : {}),
    };

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      const processedAttachments = [];
      
      for (const attachment of attachments) {
        if (attachment.path) {
          // File is already on disk
          processedAttachments.push({
            filename: attachment.name,
            path: attachment.path,
            contentType: attachment.type
          });
        } else if (attachment.content) {
          // File content is provided directly
          processedAttachments.push({
            filename: attachment.name,
            content: attachment.content,
            contentType: attachment.type
          });
        } else if (attachment.url) {
          // File needs to be read from URL/path
          try {
            const filePath = join(process.cwd(), 'public', attachment.url);
            const fileContent = await readFile(filePath);
            processedAttachments.push({
              filename: attachment.name,
              content: fileContent,
              contentType: attachment.type
            });
          } catch (error) {
            console.warn(`Could not read attachment ${attachment.name}:`, error.message);
          }
        }
      }
      
      if (processedAttachments.length > 0) {
        mailOptions.attachments = processedAttachments;
      }
    }
    
    // Send email
    const result = await transporter.sendMail(mailOptions);

    console.log('sendMail result:', {
      to: toAddress,
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      response: result.response,
    });

    if (Array.isArray(result.rejected) && result.rejected.length > 0) {
      throw new Error(
        `SMTP rejected recipient(s): ${result.rejected.join(', ')}. Server response: ${result.response || 'n/a'}`
      );
    }
    if (!Array.isArray(result.accepted) || result.accepted.length === 0) {
      throw new Error(
        `SMTP accepted no recipients for ${toAddress}. Response: ${result.response || 'n/a'}`
      );
    }

    return result;
  } catch (error) {
    console.error('Error sending email:', error);

    if (error.code === 'EAUTH') {
      console.error('SMTP Authentication failed. Please check your email credentials.');
      if (process.env.EMAIL_SIMULATE_SUCCESS_ON_EAUTH === 'true') {
        console.warn(
          'EMAIL_SIMULATE_SUCCESS_ON_EAUTH=true: returning fake success (do not use in production).'
        );
        return {
          messageId: 'fallback-' + Date.now(),
          status: 'simulated',
          note: 'Email delivery simulated due to SMTP authentication failure',
        };
      }
      throw new Error(
        'SMTP authentication failed (EAUTH). Verify EMAIL_USER, EMAIL_PASSWORD, and that the account is allowed to send mail.'
      );
    } else if (error.code === 'ECONNECTION') {
      console.error('SMTP Connection failed. Please check your email server settings.');
      throw new Error('Email connection failed. Please check your email server configuration.');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('SMTP Connection timeout. Please check your email server settings.');
      throw new Error('Email connection timeout. Please check your email server configuration.');
    }

    throw error;
  }
};
export const sendQuotationEmail = async (quotation, tenant, pdfBuffer, options = {}) => {
  const { customMessage = '', extraAttachments = [], toEmails } = options;
  const to = Array.isArray(toEmails) && toEmails.length > 0
    ? toEmails.join(', ')
    : (quotation.client?.email || '');
  if (!to) {
    throw new Error('No recipient email address');
  }
  console.log('Sending quotation email to:', to);
  
  try {
    // Create transport
    const transporter = createTransport();
    
    // Verify connection configuration
    await transporter.verify();
    console.log('SMTP connection verified successfully');

    const baseText = `Dear ${quotation.client.name},\n\nPlease find attached your quotation ${quotation.quotationNumber}.\n\nTotal amount: ${quotation.total.toLocaleString()}\nValid until: ${quotation.validUntil.toLocaleDateString()}\n\n${customMessage ? customMessage + '\n\n' : ''}Thank you for your business.\n\n${tenant.name}`;
    const attachments = [
      {
        filename: `quotation-${quotation.id}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      },
      ...extraAttachments
    ];
    
    const toAddr = typeof to === 'string' ? to.trim() : to;
    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Company Name" <noreply@example.com>',
      to: toAddr,
      subject: `Quotation ${quotation.quotationNumber} from ${tenant.name}`,
      text: baseText,
      attachments
    });

    console.log('sendMail (quotation) result:', {
      to: toAddr,
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      response: result.response,
    });

    if (Array.isArray(result.rejected) && result.rejected.length > 0) {
      throw new Error(
        `SMTP rejected recipient(s): ${result.rejected.join(', ')}. Server response: ${result.response || 'n/a'}`
      );
    }
    if (!Array.isArray(result.accepted) || result.accepted.length === 0) {
      throw new Error(`SMTP accepted no recipients for ${toAddr}. Response: ${result.response || 'n/a'}`);
    }

    return result;
  } catch (error) {
    console.error('Error sending email:', error);

    if (error.code === 'EAUTH') {
      console.error('SMTP Authentication failed. Please check your email credentials.');
      if (process.env.EMAIL_SIMULATE_SUCCESS_ON_EAUTH === 'true') {
        console.warn(
          'EMAIL_SIMULATE_SUCCESS_ON_EAUTH=true: returning fake success for quotation (not for production).'
        );
        return {
          messageId: 'mock-' + Date.now(),
          status: 'simulated',
          note: 'Email delivery simulated due to SMTP authentication failure',
        };
      }
      throw new Error(
        'SMTP authentication failed (EAUTH). Verify EMAIL_USER and EMAIL_PASSWORD for outbound mail.'
      );
    } else if (error.code === 'ECONNECTION') {
      console.error('SMTP Connection failed. Please check your email server settings.');
      throw new Error('Email connection failed. Please check your email server configuration.');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('SMTP Connection timeout. Please check your email server settings.');
      throw new Error('Email connection timeout. Please check your email server configuration.');
    }
    
    throw error;
  }
};

/**
 * Send a welcome email with account details
 * @param {string} email - Recipient email
 * @param {string} password - Account password
 * @param {string} name - Recipient name
 * @returns {Promise<Object>} Delivery result
 */
export const sendWelcomeEmail = async (email, password, name) => {
  return sendEmail({
    to: email,
    template: 'welcome-email',
    data: {
      name,
      email,
      password,
      loginUrl: `${getPublicAppBaseUrlForEmail()}/auth/login`
    }
  });
};

/**
 * Send a password reset email
 * @param {string} email - Recipient email
 * @param {string} otp - One-time password
 * @param {string} name - Recipient name
 * @returns {Promise<Object>} Delivery result
 */
export const sendPasswordResetEmail = async (email, otp, name) => {
  return sendEmail({
    to: email,
    template: 'password-reset',
    data: {
      name,
      otp,
      expiryHours: 1
    }
  });
};

/**
 * Send a password reset link email
 * @param {string} email - Recipient email
 * @param {string} resetLink - Password reset link
 * @param {string} name - Recipient name
 * @returns {Promise<Object>} Delivery result
 */
export const sendPasswordResetLinkEmail = async (email, resetLink, name) => {
  return sendEmail({
    to: email,
    template: 'password-reset-link',
    data: {
      name,
      resetLink
    }
  });
};