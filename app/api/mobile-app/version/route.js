import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function parseVersionCode(raw) {
  const n = parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Public endpoint for the Android app — no auth required.
 * Query: ?versionCode=123
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientVersionCode = parseVersionCode(searchParams.get('versionCode'));

    const row = await prisma.mobileAppConfig.findUnique({
      where: { id: 'global' },
    });

    if (!row) {
      return NextResponse.json({
        latestVersionCode: 1,
        latestVersionName: '1.0.0',
        apkDownloadUrl: '',
        releaseNotes: null,
        publishedAt: null,
        gracePeriodHours: 24,
        graceEndsAt: null,
        broadcastMessage: null,
        updateAvailable: false,
        mustLock: false,
      });
    }

    const latest = row.latestVersionCode ?? 1;
    const updateAvailable = clientVersionCode < latest;

    let graceEndsAt = null;
    if (row.publishedAt) {
      const ms = row.publishedAt.getTime() + (row.gracePeriodHours ?? 24) * 3600 * 1000;
      graceEndsAt = new Date(ms).toISOString();
    }

    const now = Date.now();
    let mustLock = false;
    if (updateAvailable) {
      if (row.forceLock) {
        mustLock = true;
      } else if (row.publishedAt && graceEndsAt) {
        const end = new Date(graceEndsAt).getTime();
        if (now > end) mustLock = true;
      }
    }

    return NextResponse.json({
      latestVersionCode: latest,
      latestVersionName: row.latestVersionName ?? '1.0.0',
      apkDownloadUrl: row.apkDownloadUrl ?? '',
      releaseNotes: row.releaseNotes ?? null,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      gracePeriodHours: row.gracePeriodHours ?? 24,
      graceEndsAt,
      broadcastMessage: row.broadcastMessage ?? null,
      updateAvailable,
      mustLock,
    });
  } catch (e) {
    console.error('mobile-app/version', e);
    return NextResponse.json(
      { error: 'Failed to read app version policy' },
      { status: 500 }
    );
  }
}
