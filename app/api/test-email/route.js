import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/emailService';

export async function GET() {
  try {
    console.log('Testing email configuration...');

    const result = await sendEmail({
      to: 'benmilanzi8@gmail.com',
      subject: 'Email Test',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Email Test</h2>
          <p>This is a test email to verify the email configuration is working.</p>
          <p>Sent at: ${new Date().toISOString()}</p>
        </div>
      `
    });

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      messageId: result.messageId,
      status: result.status
    });

  } catch (error) {
    console.error('Test email failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}