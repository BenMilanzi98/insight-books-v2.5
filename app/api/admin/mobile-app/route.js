import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';

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
        broadcastMessage: row.broadcastMessage,
        updatedAt: row.updatedAt.toISOString(),
      },
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
        broadcastMessage: row.broadcastMessage,
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    console.error('admin mobile-app POST', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
