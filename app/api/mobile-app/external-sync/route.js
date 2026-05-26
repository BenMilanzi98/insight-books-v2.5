import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

const NO_STORE = {
  'Cache-Control': 'no-store',
};

function canonicalJson(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return JSON.stringify(obj);
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return `{${pairs.join(',')}}`;
}

function verifySignature(payload, signature, secret) {
  if (!secret || !signature) return false;
  const json = canonicalJson(payload);
  const expected = crypto.createHmac('sha256', secret).update(json).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function secureEquals(a, b) {
  if (!a || !b) return false;
  const left = crypto.createHash('sha256').update(a).digest();
  const right = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(left, right);
}

function validDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Receiver for the standalone PHP Android App Management Center.
 * POST JSON: { payload: {...}, signature: "hmac" }
 * Headers: X-API-Key, X-Signature
 */
export async function POST(request) {
  try {
    const apiKey = request.headers.get('x-api-key') || '';
    const expectedKey = process.env.MOBILE_APP_CENTER_API_KEY || '';
    if (!secureEquals(apiKey, expectedKey)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    }

    const body = await request.json();
    const payload = body?.payload;
    const signature = body?.signature || request.headers.get('x-signature') || '';
    const secret = process.env.MOBILE_APP_CENTER_SHARED_SECRET || '';

    if (!payload || !verifySignature(payload, signature, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403, headers: NO_STORE });
    }

    const latestVersionCode = parseInt(String(payload.latest_version_code ?? ''), 10);
    if (!Number.isFinite(latestVersionCode) || latestVersionCode < 1) {
      return NextResponse.json(
        { error: 'Invalid latest_version_code' },
        { status: 400, headers: NO_STORE },
      );
    }

    const existing = await prisma.mobileAppConfig.findUnique({
      where: { id: 'global' },
      select: { latestVersionCode: true, publishedAt: true },
    });

    const appStatus = String(payload.app_status || '').toLowerCase();
    const forceLock = !!payload.force_lock || !!payload.mandatory_update;
    const maintenanceLock =
      !!payload.maintenance_lock ||
      appStatus === 'maintenance' ||
      appStatus === 'locked' ||
      appStatus === 'disabled';
    const maintenanceMessage =
      payload.maintenance_message ||
      payload.lock_message ||
      payload.broadcast_message ||
      (appStatus === 'locked'
        ? 'The app is temporarily locked. Please contact support.'
        : null);
    const publishedAtFromPayload = validDateOrNull(payload.published_at);
    if (payload.published_at && !publishedAtFromPayload) {
      return NextResponse.json(
        { error: 'Invalid published_at' },
        { status: 400, headers: NO_STORE },
      );
    }
    const versionChanged = existing?.latestVersionCode !== latestVersionCode;
    const publishedAt =
      publishedAtFromPayload || (versionChanged ? new Date() : existing?.publishedAt || new Date());

    const data = {
      latestVersionCode,
      latestVersionName: payload.latest_version_name || '1.0.0',
      apkDownloadUrl: payload.apk_download_url || '',
      releaseNotes: payload.release_notes || payload.whats_new || null,
      publishedAt,
      forceLock,
      websiteDownloadLocked: !!payload.website_download_locked,
      broadcastMessage: payload.broadcast_message || null,
      maintenanceLock,
      maintenanceMessage,
      // Legacy /api/mobile-app/version has grace-based locking semantics.
      // Optional PHP updates should stay optional, so give them a practically
      // non-expiring grace window instead of the old 24h default.
      gracePeriodHours: forceLock ? 0 : 876000,
      gracePeriodMinutes: forceLock ? 0 : null,
      graceEndsAt: forceLock ? new Date() : null,
    };

    await prisma.mobileAppConfig.upsert({
      where: { id: 'global' },
      create: { id: 'global', ...data },
      update: data,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Mobile app policy updated from App Center',
        latestVersionCode: data.latestVersionCode,
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    console.error('mobile-app/external-sync', e);
    return NextResponse.json(
      { error: 'Sync processing failed' },
      { status: 500, headers: NO_STORE },
    );
  }
}
