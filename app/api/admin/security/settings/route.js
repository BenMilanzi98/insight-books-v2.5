import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch security settings from database
    // For now, return default settings - you can extend this to store in database
    const defaultSettings = {
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxAge: 90
      },
      mfaSettings: {
        enabled: true,
        requireForAdmins: true,
        requireForUsers: false,
        allowedMethods: ['totp', 'sms', 'email']
      },
      sessionSettings: {
        maxSessionDuration: 24,
        idleTimeout: 30,
        maxConcurrentSessions: 3,
        requireReauthForSensitive: true
      },
      securityFeatures: {
        rateLimiting: true,
        ipWhitelist: false,
        suspiciousActivityDetection: true,
        auditLogging: true
      }
    };

    return NextResponse.json({
      success: true,
      settings: defaultSettings
    });

  } catch (error) {
    console.error('Error fetching security settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch security settings' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Settings data is required' },
        { status: 400 }
      );
    }

    // Validate settings structure
    const requiredSections = ['passwordPolicy', 'mfaSettings', 'sessionSettings', 'securityFeatures'];
    for (const section of requiredSections) {
      if (!settings[section]) {
        return NextResponse.json(
          { success: false, error: `Missing ${section} configuration` },
          { status: 400 }
        );
      }
    }

    // Log the security settings update
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'SECURITY_SETTINGS_UPDATE',
        entityType: 'SYSTEM',
        entityId: 'security_settings',
        details: 'Security settings updated',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    // Here you would typically save the settings to a database
    // For now, we'll just return success
    // You can extend this to store in a SecuritySettings table

    return NextResponse.json({
      success: true,
      message: 'Security settings updated successfully',
      settings: settings
    });

  } catch (error) {
    console.error('Error updating security settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update security settings' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 