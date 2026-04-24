import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { publicBaseUrlFromRequest, releaseApkExists } from '@/lib/mobileAppRelease';

function parseVersionCode(raw) {
  const n = parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Grace end for outdated installs: fixed [graceEndsAt], else publishedAt + minutes or hours. */
function computeGraceEndsAtIso(row) {
  if (!row) return null;
  const fixed = row.graceEndsAt != null ? new Date(row.graceEndsAt) : null;
  if (fixed && !Number.isNaN(fixed.getTime())) {
    return fixed.toISOString();
  }
  if (!row.publishedAt) return null;
  const start = row.publishedAt.getTime();
  const mins = row.gracePeriodMinutes;
  if (mins != null && Number.isFinite(mins)) {
    return new Date(start + mins * 60 * 1000).toISOString();
  }
  const h = row.gracePeriodHours ?? 24;
  return new Date(start + h * 3600 * 1000).toISOString();
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
      const onDisk = releaseApkExists();
      const base = publicBaseUrlFromRequest(request);
      const hostedUrl =
        onDisk && base ? `${base}/api/mobile-app/download` : '';
      return NextResponse.json({
        latestVersionCode: 1,
        latestVersionName: '1.0.0',
        apkDownloadUrl: hostedUrl,
        releaseNotes: null,
        publishedAt: null,
        gracePeriodHours: 24,
        gracePeriodMinutes: null,
        graceEndsAt: null,
        broadcastMessage: null,
        maintenance: false,
        maintenanceMessage: null,
        updateAvailable: false,
        mustLock: false,
        websiteDownloadAvailable: onDisk,
      });
    }

    const onDisk = releaseApkExists();
    const lockedSite = !!row.websiteDownloadLocked;
    const websiteDownloadAvailable = onDisk && !lockedSite;
    const base = publicBaseUrlFromRequest(request);
    const siteApkUrl = base ? `${base}/api/mobile-app/download` : '';
    const storedUrl = (row.apkDownloadUrl ?? '').trim();
    /** True when stored URL is the same endpoint as public site download (blocked when locked). */
    const storedIsSiteDownload =
      !!storedUrl &&
      (!!siteApkUrl
        ? storedUrl === siteApkUrl
        : storedUrl.endsWith('/api/mobile-app/download'));

    let apkDownloadUrl = '';
    if (websiteDownloadAvailable && base) {
      apkDownloadUrl = siteApkUrl;
    } else if (!lockedSite) {
      apkDownloadUrl = storedUrl;
    } else if (storedUrl && !storedIsSiteDownload) {
      // Website APK is locked, but admins can still point the app at Play Store / CDN / direct APK URL.
      apkDownloadUrl = storedUrl;
    }

    const maintenance = !!row.maintenanceLock;
    const maintenanceMessage = row.maintenanceMessage ?? null;

    if (maintenance) {
      return NextResponse.json({
        latestVersionCode: row.latestVersionCode ?? 1,
        latestVersionName: row.latestVersionName ?? '1.0.0',
        apkDownloadUrl,
        releaseNotes: row.releaseNotes ?? null,
        publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
        gracePeriodHours: row.gracePeriodHours ?? 24,
        gracePeriodMinutes: null,
        graceEndsAt: null,
        broadcastMessage: row.broadcastMessage ?? null,
        maintenance: true,
        maintenanceMessage,
        updateAvailable: true,
        mustLock: true,
        websiteDownloadAvailable,
      });
    }

    const latest = row.latestVersionCode ?? 1;
    const updateAvailable = clientVersionCode < latest;

    const graceEndsAt = computeGraceEndsAtIso(row);

    const now = Date.now();
    let mustLock = false;
    if (updateAvailable) {
      if (row.forceLock) {
        mustLock = true;
      } else if (graceEndsAt) {
        const end = new Date(graceEndsAt).getTime();
        // Inclusive at the exact deadline instant (wall-clock "by this time").
        if (now >= end) mustLock = true;
      }
    }

    return NextResponse.json({
      latestVersionCode: latest,
      latestVersionName: row.latestVersionName ?? '1.0.0',
      apkDownloadUrl,
      releaseNotes: row.releaseNotes ?? null,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      gracePeriodHours: row.gracePeriodHours ?? 24,
      gracePeriodMinutes: row.gracePeriodMinutes ?? null,
      graceEndsAt,
      broadcastMessage: row.broadcastMessage ?? null,
      maintenance: false,
      maintenanceMessage: null,
      /** Echo of query param — same logic the app uses for `updateAvailable` / lock. */
      clientVersionCode,
      updateAvailable,
      mustLock,
      websiteDownloadAvailable,
    });
  } catch (e) {
    console.error('mobile-app/version', e);
    return NextResponse.json(
      { error: 'Failed to read app version policy' },
      { status: 500 }
    );
  }
}
