import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_PLATFORM_SETTINGS,
  maskSettingsForClient,
  mergeSettings,
} from '@/lib/admin/platformSettings';

const GLOBAL_ID = 'global';

function clientMeta(request) {
  return {
    ipAddress:
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

function normalizeStored(row) {
  const data = row?.data && typeof row.data === 'object' ? row.data : {};
  const settings = {
    ...DEFAULT_PLATFORM_SETTINGS,
    ...(data.settings && typeof data.settings === 'object' ? data.settings : {}),
  };
  const featureFlags = {
    ...DEFAULT_FEATURE_FLAGS,
    ...(data.featureFlags && typeof data.featureFlags === 'object' ? data.featureFlags : {}),
  };
  return { settings, featureFlags, version: row?.version ?? 1, updatedAt: row?.updatedAt ?? null };
}

/**
 * GET /api/admin/settings — persisted PlatformGlobalSettings without secrets.
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.settings.view)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    let row = await prisma.platformGlobalSettings.findUnique({
      where: { id: GLOBAL_ID },
    });

    if (!row) {
      row = await prisma.platformGlobalSettings.create({
        data: {
          id: GLOBAL_ID,
          data: {
            settings: DEFAULT_PLATFORM_SETTINGS,
            featureFlags: DEFAULT_FEATURE_FLAGS,
          },
          version: 1,
          updatedBy: admin.id,
        },
      });
    }

    const normalized = normalizeStored(row);

    return NextResponse.json({
      success: true,
      settings: maskSettingsForClient(normalized.settings),
      featureFlags: normalized.featureFlags,
      version: normalized.version,
      systemInfo: {
        version: process.env.npm_package_version || '2.5',
        environment: process.env.NODE_ENV || 'development',
        lastUpdated: normalized.updatedAt?.toISOString?.() || null,
      },
    });
  } catch (error) {
    console.error('Admin settings fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/settings — merge settings, increment version, never echo secrets.
 * Empty secret fields mean "keep existing".
 */
export async function PUT(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.settings.manage)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { settings: incomingSettings, featureFlags: incomingFlags } = body;

    if (!incomingSettings || typeof incomingSettings !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Settings data is required' },
        { status: 400 }
      );
    }

    if (!incomingSettings.appName || !incomingSettings.supportEmail) {
      return NextResponse.json(
        { success: false, error: 'Application name and support email are required' },
        { status: 400 }
      );
    }

    if (incomingSettings.smtpHost && !incomingSettings.smtpPort) {
      return NextResponse.json(
        { success: false, error: 'SMTP port is required when SMTP host is specified' },
        { status: 400 }
      );
    }

    if (
      incomingSettings.sessionTimeout &&
      (incomingSettings.sessionTimeout < 1 || incomingSettings.sessionTimeout > 1440)
    ) {
      return NextResponse.json(
        { success: false, error: 'Session timeout must be between 1 and 1440 minutes' },
        { status: 400 }
      );
    }

    if (
      incomingSettings.maxLoginAttempts &&
      (incomingSettings.maxLoginAttempts < 1 || incomingSettings.maxLoginAttempts > 20)
    ) {
      return NextResponse.json(
        { success: false, error: 'Maximum login attempts must be between 1 and 20' },
        { status: 400 }
      );
    }

    if (
      incomingSettings.dbPoolSize &&
      (incomingSettings.dbPoolSize < 1 || incomingSettings.dbPoolSize > 100)
    ) {
      return NextResponse.json(
        { success: false, error: 'Database pool size must be between 1 and 100' },
        { status: 400 }
      );
    }

    if (
      incomingSettings.rateLimit &&
      (incomingSettings.rateLimit < 1 || incomingSettings.rateLimit > 10000)
    ) {
      return NextResponse.json(
        { success: false, error: 'Rate limit must be between 1 and 10000 requests per minute' },
        { status: 400 }
      );
    }

    let row = await prisma.platformGlobalSettings.findUnique({
      where: { id: GLOBAL_ID },
    });

    if (!row) {
      row = await prisma.platformGlobalSettings.create({
        data: {
          id: GLOBAL_ID,
          data: {
            settings: DEFAULT_PLATFORM_SETTINGS,
            featureFlags: DEFAULT_FEATURE_FLAGS,
          },
          version: 1,
          updatedBy: admin.id,
        },
      });
    }

    const current = normalizeStored(row);
    const mergedSettings = mergeSettings(current.settings, incomingSettings);
    const mergedFlags = {
      ...current.featureFlags,
      ...(incomingFlags && typeof incomingFlags === 'object' ? incomingFlags : {}),
    };

    const updated = await prisma.platformGlobalSettings.update({
      where: { id: GLOBAL_ID },
      data: {
        data: {
          settings: mergedSettings,
          featureFlags: mergedFlags,
        },
        version: { increment: 1 },
        updatedBy: admin.id,
      },
    });

    const meta = clientMeta(request);
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'SETTINGS_UPDATE',
        entityType: 'SYSTEM',
        entityId: 'GLOBAL_SETTINGS',
        details: JSON.stringify({
          version: updated.version,
          keysUpdated: Object.keys(incomingSettings || {}),
          featureFlagsUpdated: Object.keys(incomingFlags || {}),
        }),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    const normalized = normalizeStored(updated);

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      settings: maskSettingsForClient(normalized.settings),
      featureFlags: normalized.featureFlags,
      version: normalized.version,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Admin settings update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
