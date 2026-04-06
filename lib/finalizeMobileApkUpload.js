import fs from 'fs/promises';
import path from 'path';

import prisma from '@/lib/prisma';
import {
  getReleaseApkPath,
  RELEASE_APK_FILENAME,
} from '@/lib/mobileAppRelease';

export const MOBILE_APK_MAX_BYTES = 250 * 1024 * 1024; // 250 MB

export function isZipLikeApk(buffer) {
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
 * Write APK to disk and update MobileAppConfig (shared by App Router and Pages API upload).
 * @param {object} opts
 * @param {Buffer} opts.buffer
 * @param {number} opts.latestVersionCode
 * @param {string} opts.latestVersionName
 * @param {boolean} opts.publish
 * @param {boolean} opts.websiteDownloadLocked
 * @param {string} opts.publicBaseUrl — no trailing slash; empty uses relative download path
 */
export async function finalizeMobileApkUpload({
  buffer,
  latestVersionCode,
  latestVersionName,
  publish,
  websiteDownloadLocked,
  publicBaseUrl,
}) {
  if (buffer.length > MOBILE_APK_MAX_BYTES) {
    throw new Error(
      `APK too large (max ${MOBILE_APK_MAX_BYTES / (1024 * 1024)} MB)`
    );
  }
  if (!isZipLikeApk(buffer)) {
    throw new Error('File does not look like an APK (ZIP)');
  }

  const dest = getReleaseApkPath();
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buffer);

  await ensureConfigRow();
  const apkDownloadUrl = publicBaseUrl
    ? `${publicBaseUrl}/api/mobile-app/download`
    : '/api/mobile-app/download';

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

  return {
    RELEASE_APK_FILENAME,
    bufferLength: buffer.length,
    row,
  };
}

/** Base URL for admin upload responses (Node IncomingMessage headers). */
export function publicBaseUrlFromNodeReq(req) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) return (envUrl || '').replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`.replace(/\/$/, '');
}
