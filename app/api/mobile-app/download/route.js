import { NextResponse } from 'next/server';
import fs from 'fs';
import { Readable } from 'node:stream';
import prisma from '@/lib/prisma';
import { getReleaseApkPath, releaseApkExists } from '@/lib/mobileAppRelease';

export const runtime = 'nodejs';

/**
 * Public APK download (no auth). Respects websiteDownloadLocked on MobileAppConfig.
 */
export async function GET() {
  try {
    const row = await prisma.mobileAppConfig.findUnique({
      where: { id: 'global' },
    });

    if (row?.websiteDownloadLocked) {
      return NextResponse.json(
        { error: 'Download is temporarily unavailable.' },
        { status: 403 }
      );
    }

    if (!releaseApkExists()) {
      return NextResponse.json({ error: 'No release APK has been uploaded yet.' }, { status: 404 });
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
  } catch (e) {
    console.error('mobile-app/download', e);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
