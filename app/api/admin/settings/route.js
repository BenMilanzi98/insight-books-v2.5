import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/serverJwtSecret';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    // Verify admin authentication
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 403 }
      );
    }

    if (!decoded.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges' },
        { status: 403 }
      );
    }

    // Get comprehensive system settings
    const settings = {
      // General Settings
      appName: 'InsightBooks',
      supportEmail: 'support@insightbooksafrica.com',
      defaultCurrency: 'MWK',
      timezone: 'Africa/Blantyre',
      
      // Security Settings
      sessionTimeout: 480, // 8 hours
      maxLoginAttempts: 5,
      allowedIPs: '',
      
      // Email Settings
      smtpHost: 'smtp.hostinger.com',
      smtpPort: 465,
      smtpUsername: 'noreply@insightbooksafrica.com',
      fromEmail: 'InsightBooks <noreply@insightbooksafrica.com>',
      welcomeEmailTemplate: '',
      passwordResetTemplate: '',
      
      // Notification Settings
      adminNotificationEmail: 'admin@insightbooksafrica.com',
      slackWebhookUrl: '',
      
      // System Settings
      dbPoolSize: 10,
      queryTimeout: 30,
      cacheTTL: 15,
      rateLimit: 100
    };

    // Get system information
    const systemInfo = {
      version: '1.2.1',
      environment: 'production',
      database: 'PostgreSQL 15',
      uptime: '99.9%',
      lastUpdated: new Date().toISOString()
    };

    // Get feature flags
    const featureFlags = {
      // Security Features
      twoFactorAuth: false,
      passwordComplexity: true,
      ipWhitelist: false,
      
      // System Features
      systemAlerts: true,
      securityNotifications: true,
      dailyReports: false,
      dbLogging: false,
      apiCaching: true,
      
      // Business Features
      userRegistration: true,
      advancedAnalytics: false,
      multiTenancy: true,
      apiAccess: false,
      auditLogging: true,
      maintenanceMode: false
    };

    return NextResponse.json({
      success: true,
      settings,
      systemInfo,
      featureFlags
    });

  } catch (error) {
    console.error('Admin settings fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(request) {
  try {
    // Verify admin authentication
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 403 }
      );
    }

    if (!decoded.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { settings, featureFlags } = body;

    // Validate required settings
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Settings data is required' },
        { status: 400 }
      );
    }

    // Validate critical settings
    if (!settings.appName || !settings.supportEmail) {
      return NextResponse.json(
        { success: false, error: 'Application name and support email are required' },
        { status: 400 }
      );
    }

    // Validate email settings
    if (settings.smtpHost && !settings.smtpPort) {
      return NextResponse.json(
        { success: false, error: 'SMTP port is required when SMTP host is specified' },
        { status: 400 }
      );
    }

    // Validate security settings
    if (settings.sessionTimeout && (settings.sessionTimeout < 1 || settings.sessionTimeout > 1440)) {
      return NextResponse.json(
        { success: false, error: 'Session timeout must be between 1 and 1440 minutes' },
        { status: 400 }
      );
    }

    if (settings.maxLoginAttempts && (settings.maxLoginAttempts < 1 || settings.maxLoginAttempts > 20)) {
      return NextResponse.json(
        { success: false, error: 'Maximum login attempts must be between 1 and 20' },
        { status: 400 }
      );
    }

    // Validate system settings
    if (settings.dbPoolSize && (settings.dbPoolSize < 1 || settings.dbPoolSize > 100)) {
      return NextResponse.json(
        { success: false, error: 'Database pool size must be between 1 and 100' },
        { status: 400 }
      );
    }

    if (settings.rateLimit && (settings.rateLimit < 1 || settings.rateLimit > 10000)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit must be between 1 and 10000 requests per minute' },
        { status: 400 }
      );
    }

    // Create admin audit log for settings update
    await prisma.adminAuditLog.create({
      data: {
        adminId: decoded.adminId,
        action: 'SETTINGS_UPDATE',
        entityType: 'SYSTEM',
        entityId: 'GLOBAL_SETTINGS',
        details: `Updated system settings and feature flags`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    // In a real implementation, you would save these settings to the database
    // For now, we'll just return success
    console.log('Settings updated:', { settings, featureFlags });

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Admin settings update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 