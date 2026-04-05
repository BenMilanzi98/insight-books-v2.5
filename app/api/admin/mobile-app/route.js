import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { getReleaseApkStats } from '@/lib/mobileAppRelease';

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

    const row = await ensureRow();
    const st = getReleaseApkStats();
    return NextResponse.json({
      success: true,
      config: {
        latestVersionCode: row.latestVersionCode,
        latestVersionName: row.latestVersionName,
        apkDownloadUrl: row.apkDownloadUrl,
        releaseNotes: row.releaseNotes,
        publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
        gracePeriodHours: row.gracePeriodHours,
        forceLock: row.forceLock,
        websiteDownloadLocked: row.websiteDownloadLocked,
        broadcastMessage: row.broadcastMessage,
        updatedAt: row.updatedAt.toISOString(),
      },
      releaseFile: st
        ? { exists: true, size: st.size, mtime: st.mtime.toISOString() }
        : { exists: false },
    });
  } catch (e) {
    console.error('admin mobile-app GET', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

/**
 * Body:
 * - latestVersionCode, latestVersionName, apkDownloadUrl, releaseNotes?, gracePeriodHours?, broadcastMessage?
 * - forceLock?: boolean
 * - websiteDownloadLocked?: boolean — instant lock: blocks public /api/mobile-app/download
 * - publish?: boolean — if true, sets publishedAt to now (starts 24h grace by default)
 * - clearPublish?: boolean — clears publishedAt (stops timed lock until republished)
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    await ensureRow();

    const data = {};

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
    if (body.broadcastMessage !== undefined) {
      data.broadcastMessage = body.broadcastMessage ? String(body.broadcastMessage) : null;
    }
    if (body.forceLock !== undefined) data.forceLock = !!body.forceLock;
    if (body.websiteDownloadLocked !== undefined) {
      data.websiteDownloadLocked = !!body.websiteDownloadLocked;
    }

    if (body.clearPublish === true) {
      data.publishedAt = null;
    }
    if (body.publish === true) {
      data.publishedAt = new Date();
    }

    const row = await prisma.mobileAppConfig.update({
      where: { id: 'global' },
      data,
    });

    const st = getReleaseApkStats();
    return NextResponse.json({
      success: true,
      config: {
        latestVersionCode: row.latestVersionCode,
        latestVersionName: row.latestVersionName,
        apkDownloadUrl: row.apkDownloadUrl,
        releaseNotes: row.releaseNotes,
        publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
        gracePeriodHours: row.gracePeriodHours,
        forceLock: row.forceLock,
        websiteDownloadLocked: row.websiteDownloadLocked,
        broadcastMessage: row.broadcastMessage,
        updatedAt: row.updatedAt.toISOString(),
      },
      releaseFile: st
        ? { exists: true, size: st.size, mtime: st.mtime.toISOString() }
        : { exists: false },
    });
  } catch (e) {
    console.error('admin mobile-app POST', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
