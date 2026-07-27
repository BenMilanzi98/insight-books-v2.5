import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { getReleaseApkStats } from '@/lib/mobileAppRelease';
import {
  ANDROID_SECRET_DENYLIST,
  assertNoSigningSecrets,
  assertReleaseChannel,
  assertValidChecksum,
} from '@/lib/admin/androidRelease';

/**
 * Public-safe mobile app config for admin UI.
 * Signing credentials (keystore, passwords, Play signing keys) are NEVER stored
 * or returned by this API — only release metadata, checksum, and lock flags.
 */

function toPublicMobileConfig(row) {
  if (!row) return null;
  const config = {
    latestVersionCode: row.latestVersionCode,
    latestVersionName: row.latestVersionName,
    apkDownloadUrl: row.apkDownloadUrl,
    apkChecksum: row.apkChecksum || null,
    apkFileSize: row.apkFileSize ?? null,
    releaseChannel: row.releaseChannel || 'STABLE',
    releaseNotes: row.releaseNotes,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    gracePeriodHours: row.gracePeriodHours,
    gracePeriodMinutes: row.gracePeriodMinutes,
    graceEndsAt: row.graceEndsAt ? row.graceEndsAt.toISOString() : null,
    forceLock: row.forceLock,
    websiteDownloadLocked: row.websiteDownloadLocked,
    broadcastMessage: row.broadcastMessage,
    maintenanceLock: row.maintenanceLock,
    maintenanceMessage: row.maintenanceMessage,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
  for (const key of ANDROID_SECRET_DENYLIST) {
    if (key in config) delete config[key];
  }
  return config;
}

async function ensureRow() {
  return prisma.mobileAppConfig.upsert({
    where: { id: 'global' },
    create: {
      id: 'global',
      latestVersionCode: 1,
      latestVersionName: '1.0.0',
      apkDownloadUrl: '',
      gracePeriodHours: 24,
      forceLock: false,
      websiteDownloadLocked: false,
      maintenanceLock: false,
    },
    update: {},
  });
}

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.android.view)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const row = await ensureRow();
    const st = getReleaseApkStats();
    return NextResponse.json({
      success: true,
      config: toPublicMobileConfig(row),
      // Signing credentials are never returned by this endpoint.
      releaseFile: st
        ? { exists: true, size: st.size, mtime: st.mtime.toISOString() }
        : { exists: false },
    });
  } catch (e) {
    console.error('admin mobile-app GET', e);
    const code = e && typeof e === 'object' && 'code' in e ? String(e.code) : '';
    const msg = e instanceof Error ? e.message : String(e);
    const prismaKnown = /^P[0-9]+$/.test(code);
    if (code === 'P2022') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Database schema is out of date. Run `npx prisma migrate deploy` on this environment. ' + msg,
        },
        { status: 503 },
      );
    }
    if (prismaKnown) {
      return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
    return NextResponse.json(
      { success: false, error: process.env.NODE_ENV === 'development' ? msg : 'Internal error' },
      { status: 500 },
    );
  }
}

/**
 * Body:
 * - latestVersionCode, latestVersionName, apkDownloadUrl, releaseNotes?, gracePeriodHours?, gracePeriodMinutes?, graceEndsAt?
 * - forceLock?: boolean
 * - websiteDownloadLocked?: boolean — instant lock: blocks public /api/mobile-app/download
 * - maintenanceLock?: boolean — full-screen lock for all app installs (emergency)
 * - maintenanceMessage?: string | null
 * - publish?: boolean — if true, sets publishedAt to now (starts 24h grace by default)
 * - clearPublish?: boolean — clears publishedAt and graceEndsAt (stops timed lock until republished)
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.android.createRelease) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.android.publishRelease) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.android.revokeRelease)
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const secretCheck = assertNoSigningSecrets(body);
    if (!secretCheck.ok) {
      return NextResponse.json({ success: false, error: secretCheck.error }, { status: 400 });
    }
    await ensureRow();

    const data = {};

    if (body.apkChecksum !== undefined) {
      const c = assertValidChecksum(body.apkChecksum);
      if (!c.ok) {
        return NextResponse.json({ success: false, error: c.error }, { status: 400 });
      }
      data.apkChecksum = c.checksum;
    }
    if (body.apkFileSize !== undefined) {
      const size = parseInt(String(body.apkFileSize), 10);
      if (!Number.isFinite(size) || size < 0) {
        return NextResponse.json({ success: false, error: 'Invalid apkFileSize' }, { status: 400 });
      }
      data.apkFileSize = size;
    }
    if (body.releaseChannel !== undefined) {
      const ch = assertReleaseChannel(body.releaseChannel);
      if (!ch.ok) {
        return NextResponse.json({ success: false, error: ch.error }, { status: 400 });
      }
      data.releaseChannel = ch.channel;
    }

    if (body.latestVersionCode !== undefined) {
      const n = parseInt(String(body.latestVersionCode), 10);
      if (!Number.isFinite(n) || n < 1) {
        return NextResponse.json({ success: false, error: 'Invalid latestVersionCode' }, { status: 400 });
      }
      data.latestVersionCode = n;
    }
    if (body.latestVersionName !== undefined) data.latestVersionName = String(body.latestVersionName).trim();
    if (body.apkDownloadUrl !== undefined) data.apkDownloadUrl = String(body.apkDownloadUrl).trim();
    if (body.releaseNotes !== undefined) data.releaseNotes = body.releaseNotes ? String(body.releaseNotes) : null;
    if (body.gracePeriodHours !== undefined) {
      const g = parseInt(String(body.gracePeriodHours), 10);
      if (!Number.isFinite(g) || g < 0 || g > 8760) {
        return NextResponse.json({ success: false, error: 'Invalid gracePeriodHours' }, { status: 400 });
      }
      data.gracePeriodHours = g;
    }
    if (body.gracePeriodMinutes !== undefined) {
      if (body.gracePeriodMinutes === null || body.gracePeriodMinutes === '') {
        data.gracePeriodMinutes = null;
      } else {
        const m = parseInt(String(body.gracePeriodMinutes), 10);
        if (!Number.isFinite(m) || m < 0 || m > 525600) {
          return NextResponse.json(
            { success: false, error: 'Invalid gracePeriodMinutes (0–525600)' },
            { status: 400 },
          );
        }
        data.gracePeriodMinutes = m;
      }
    }
    if (body.graceEndsAt !== undefined) {
      if (body.graceEndsAt === null || body.graceEndsAt === '') {
        data.graceEndsAt = null;
      } else {
        const d = new Date(String(body.graceEndsAt));
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ success: false, error: 'Invalid graceEndsAt' }, { status: 400 });
        }
        data.graceEndsAt = d;
      }
    }
    if (body.broadcastMessage !== undefined) {
      data.broadcastMessage = body.broadcastMessage ? String(body.broadcastMessage) : null;
    }
    if (body.forceLock !== undefined) data.forceLock = !!body.forceLock;
    if (body.websiteDownloadLocked !== undefined) {
      data.websiteDownloadLocked = !!body.websiteDownloadLocked;
    }
    if (body.maintenanceLock !== undefined) {
      data.maintenanceLock = !!body.maintenanceLock;
    }
    if (body.maintenanceMessage !== undefined) {
      data.maintenanceMessage = body.maintenanceMessage
        ? String(body.maintenanceMessage).trim().slice(0, 2000)
        : null;
    }

    if (body.clearPublish === true) {
      data.publishedAt = null;
      data.graceEndsAt = null;
    }
    if (body.publish === true) {
      data.publishedAt = new Date();
    }

    /** Prisma rejects `update({ data: {} })`; some clients may send only `publish`/`clearPublish` merged oddly. */
    let row;
    if (Object.keys(data).length === 0) {
      row = await prisma.mobileAppConfig.findUnique({ where: { id: 'global' } });
      if (!row) {
        return NextResponse.json({ success: false, error: 'Mobile app config row missing' }, { status: 500 });
      }
    } else {
      row = await prisma.mobileAppConfig.update({
        where: { id: 'global' },
        data,
      });
    }

    const st = getReleaseApkStats();
    return NextResponse.json({
      success: true,
      config: toPublicMobileConfig(row),
      // Signing credentials are never returned by this endpoint.
      releaseFile: st
        ? { exists: true, size: st.size, mtime: st.mtime.toISOString() }
        : { exists: false },
    });
  } catch (e) {
    console.error('admin mobile-app POST', e);
    const code = e && typeof e === 'object' && 'code' in e ? String(e.code) : '';
    const msg = e instanceof Error ? e.message : String(e);
    const prismaKnown = /^P[0-9]+$/.test(code);
    /** P2022 = column missing in DB (migrations not applied). */
    if (code === 'P2022') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Database schema is out of date. Run `npx prisma migrate deploy` on this environment. ' + msg,
        },
        { status: 503 },
      );
    }
    if (prismaKnown) {
      return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
    return NextResponse.json(
      { success: false, error: process.env.NODE_ENV === 'development' ? msg : 'Internal error' },
      { status: 500 },
    );
  }
}
