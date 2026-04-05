import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  getReleaseApkPath,
  RELEASE_APK_FILENAME,
  publicBaseUrlFromRequest,
} from '@/lib/mobileAppRelease';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_BYTES = 250 * 1024 * 1024; // 250 MB

function isZipLikeApk(buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

async function ensureConfigRow() {
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

/**
 * Multipart upload: field "apk" (file), optional "latestVersionCode", "latestVersionName",
 * optional "publish" (true to set publishedAt), optional "websiteDownloadLocked" (string "true"/"false").
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('apk');
    if (!file || typeof file === 'string' || !file.size) {
      return NextResponse.json(
        { success: false, error: 'Missing APK file (field name: apk)' },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: `APK too large (max ${MAX_BYTES / (1024 * 1024)} MB)` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!isZipLikeApk(buffer)) {
      return NextResponse.json(
        { success: false, error: 'File does not look like an APK (ZIP)' },
        { status: 400 }
      );
    }

    const vCodeRaw = formData.get('latestVersionCode');
    const vNameRaw = formData.get('latestVersionName');
    const publish = formData.get('publish') === 'true' || formData.get('publish') === '1';
    const lockRaw = formData.get('websiteDownloadLocked');
    const websiteDownloadLocked =
      lockRaw === 'true' || lockRaw === '1' || lockRaw === 'on';

    const latestVersionCode = vCodeRaw != null ? parseInt(String(vCodeRaw), 10) : null;
    if (latestVersionCode == null || !Number.isFinite(latestVersionCode) || latestVersionCode < 1) {
      return NextResponse.json(
        { success: false, error: 'latestVersionCode is required (integer ≥ 1)' },
        { status: 400 }
      );
    }

    const latestVersionName =
      vNameRaw != null && String(vNameRaw).trim()
        ? String(vNameRaw).trim()
        : String(latestVersionCode);

    const dest = getReleaseApkPath();
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);

    await ensureConfigRow();
    const base = publicBaseUrlFromRequest(request);
    const apkDownloadUrl = base ? `${base}/api/mobile-app/download` : '/api/mobile-app/download';

    const data = {
      latestVersionCode,
      latestVersionName,
      apkDownloadUrl,
      websiteDownloadLocked,
    };
    if (publish) data.publishedAt = new Date();

    const row = await prisma.mobileAppConfig.update({
      where: { id: 'global' },
      data,
    });

    return NextResponse.json({
      success: true,
      message: `Saved ${RELEASE_APK_FILENAME} (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`,
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
    });
  } catch (e) {
    console.error('admin mobile-app upload', e);
    return NextResponse.json(
      { success: false, error: e?.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
