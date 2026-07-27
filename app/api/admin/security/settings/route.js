import { NextResponse } from 'next/server';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import prisma from '@/lib/prisma';
import { maskSettingsForClient, mergeSettings } from '@/lib/admin/platformSettings';
import { appendAdminAuditLog } from '@/lib/admin/appendOnlyAudit';

const GLOBAL_ID = 'global';

/** Documented defaults — not claimed as persisted until saved. */
export const DEFAULT_SECURITY_SETTINGS = {
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAge: 90,
  },
  mfaSettings: {
    enabled: false,
    requireForAdmins: true,
    requireForUsers: false,
    allowedMethods: ['totp', 'email'],
  },
  sessionSettings: {
    maxSessionDuration: 24,
    idleTimeout: 30,
    maxConcurrentSessions: 3,
    requireReauthForSensitive: true,
  },
  securityFeatures: {
    rateLimiting: true,
    ipWhitelist: false,
    suspiciousActivityDetection: false,
    auditLogging: true,
  },
};

function deepMerge(base, incoming) {
  if (!incoming || typeof incoming !== 'object') return { ...base };
  const out = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      base[key] &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      out[key] = deepMerge(base[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function clientMeta(request) {
  return {
    ipAddress:
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.security.view) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.settings.security)
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const row = await prisma.platformGlobalSettings.findUnique({
      where: { id: GLOBAL_ID },
    });

    const data = row?.data && typeof row.data === 'object' ? row.data : {};
    const stored =
      data.security && typeof data.security === 'object' ? data.security : null;

    if (!stored) {
      return NextResponse.json({
        success: true,
        settings: maskSettingsForClient(DEFAULT_SECURITY_SETTINGS),
        persisted: false,
        source: 'defaults',
        message: 'No security settings saved yet; returning documented defaults',
      });
    }

    const merged = deepMerge(DEFAULT_SECURITY_SETTINGS, stored);
    return NextResponse.json({
      success: true,
      settings: maskSettingsForClient(merged),
      persisted: true,
      source: 'platform_global_settings',
    });
  } catch (error) {
    console.error('Error fetching security settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch security settings' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.settings.security) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.security.manageAlerts)
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Settings data is required' },
        { status: 400 }
      );
    }

    const requiredSections = [
      'passwordPolicy',
      'mfaSettings',
      'sessionSettings',
      'securityFeatures',
    ];
    for (const section of requiredSections) {
      if (!settings[section]) {
        return NextResponse.json(
          { success: false, error: `Missing ${section} configuration` },
          { status: 400 }
        );
      }
    }

    let row = await prisma.platformGlobalSettings.findUnique({
      where: { id: GLOBAL_ID },
    });

    if (!row) {
      row = await prisma.platformGlobalSettings.create({
        data: {
          id: GLOBAL_ID,
          data: { security: deepMerge(DEFAULT_SECURITY_SETTINGS, settings) },
          version: 1,
          updatedBy: admin.id,
        },
      });
    } else {
      const existingData =
        row.data && typeof row.data === 'object' ? { ...row.data } : {};
      const previousSecurity =
        existingData.security && typeof existingData.security === 'object'
          ? existingData.security
          : {};
      // Flat merge for any top-level secret keys; deep-merge sections
      const sectionMerged = deepMerge(
        deepMerge(DEFAULT_SECURITY_SETTINGS, previousSecurity),
        settings
      );
      const withSecrets = mergeSettings(previousSecurity, sectionMerged);
      existingData.security = withSecrets;

      row = await prisma.platformGlobalSettings.update({
        where: { id: GLOBAL_ID },
        data: {
          data: existingData,
          version: (row.version || 1) + 1,
          updatedBy: admin.id,
        },
      });
    }

    const meta = clientMeta(request);
    await appendAdminAuditLog({
      adminId: admin.id,
      action: 'SECURITY_SETTINGS_UPDATE',
      entityType: 'SYSTEM',
      entityId: 'security_settings',
      details: 'Security settings persisted to PlatformGlobalSettings',
      ...meta,
    });

    const saved =
      row.data?.security && typeof row.data.security === 'object'
        ? deepMerge(DEFAULT_SECURITY_SETTINGS, row.data.security)
        : DEFAULT_SECURITY_SETTINGS;

    return NextResponse.json({
      success: true,
      message: 'Security settings saved',
      settings: maskSettingsForClient(saved),
      persisted: true,
      source: 'platform_global_settings',
    });
  } catch (error) {
    console.error('Error updating security settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update security settings' },
      { status: 500 }
    );
  }
}
