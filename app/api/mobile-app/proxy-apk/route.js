import { NextResponse } from 'next/server';
import fs from 'fs';
import { Readable } from 'node:stream';
import prisma from '@/lib/prisma';
import {
  getReleaseApkPath,
  publicBaseUrlFromRequest,
  releaseApkExists,
} from '@/lib/mobileAppRelease';

export const runtime = 'nodejs';

/** Same effective URL logic as `/api/mobile-app/version` for `apkDownloadUrl`. */
function computeEffectiveApkDownloadUrl(row, base) {
  if (!row) {
    const onDisk = releaseApkExists();
    return onDisk && base ? `${base}/api/mobile-app/download` : '';
  }
  const onDisk = releaseApkExists();
  const lockedSite = !!row?.websiteDownloadLocked;
  const websiteDownloadAvailable = onDisk && !lockedSite;
  const siteApkUrl = base ? `${base}/api/mobile-app/download` : '';
  const storedUrl = (row?.apkDownloadUrl ?? '').trim();
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
    apkDownloadUrl = storedUrl;
  }
  return apkDownloadUrl.trim();
}

/** True when the configured URL is our on-disk hosted APK endpoint (avoid self-fetch loop). */
function isOurHostedDownload(apkDownloadUrl, request, base) {
  const u = apkDownloadUrl.trim();
  if (u.startsWith('/')) {
    const p = u.split('?')[0].replace(/\/$/, '') || '/';
    return p === '/api/mobile-app/download';
  }
  try {
    const parsed = new URL(u);
    const reqHost = (
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      ''
    ).split(':')[0];
    const pathNorm = parsed.pathname.replace(/\/$/, '') || '/';
    return pathNorm === '/api/mobile-app/download' && parsed.hostname === reqHost;
  } catch {
    return false;
  }
}

/**
 * GET /api/mobile-app/proxy-apk
 *
 * Streams the APK configured for mobile app downloads. Browser calls this same-origin URL so
 * progress + blob save work; the server fetches external hosts (files.fm, etc.) — no CORS.
 */
export async function GET(request) {
  try {
    const row = await prisma.mobileAppConfig.findUnique({
      where: { id: 'global' },
    });

    const base = publicBaseUrlFromRequest(request);
    const apkDownloadUrl = computeEffectiveApkDownloadUrl(row, base);

    if (!apkDownloadUrl) {
      return NextResponse.json(
        { error: 'No APK download is configured.' },
        { status: 404 },
      );
    }

    if (isOurHostedDownload(apkDownloadUrl, request, base)) {
      if (row?.websiteDownloadLocked) {
        return NextResponse.json(
          { error: 'Download is temporarily unavailable.' },
          { status: 403 },
        );
      }
      if (!releaseApkExists()) {
        return NextResponse.json(
          { error: 'No release APK has been uploaded yet.' },
          { status: 404 },
        );
      }

      const filePath = getReleaseApkPath();
      const stat = fs.statSync(filePath);
      const nodeStream = fs.createReadStream(filePath);
      const webStream = Readable.toWeb(nodeStream);

      return new NextResponse(webStream, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Length': String(stat.size),
          'Content-Disposition': 'attachment; filename="InsightBooks-android.apk"',
          'Cache-Control': 'no-store',
        },
      });
    }

    let upstream;
    try {
      upstream = await fetch(apkDownloadUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'InsightBooksDownloadProxy/1.0',
          Accept: '*/*',
        },
      });
    } catch (e) {
      console.error('mobile-app/proxy-apk upstream fetch', e);
      return NextResponse.json(
        { error: 'Could not reach the APK download server.' },
        { status: 502 },
      );
    }

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      return NextResponse.json(
        {
          error:
            text?.slice(0, 240) ||
            (upstream.status === 404 ? 'APK not found at the configured URL.' : `Upstream HTTP ${upstream.status}`),
        },
        { status: upstream.status >= 400 ? upstream.status : 502 },
      );
    }

    const rawType = upstream.headers.get('content-type') || '';
    const ct = rawType
      ? rawType.split(';')[0].trim()
      : 'application/vnd.android.package-archive';
    const len = upstream.headers.get('content-length');

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': ct || 'application/vnd.android.package-archive',
        ...(len ? { 'Content-Length': len } : {}),
        'Content-Disposition': 'attachment; filename="InsightBooks-android.apk"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('mobile-app/proxy-apk', e);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
