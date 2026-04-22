import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  allowTelemetryPost,
  telemetryRateLimitKey,
} from '@/lib/mobileAppTelemetryRateLimit';

const MAX_BODY_BYTES = 8192;

const ALLOWED_TYPES = new Set([
  'version_check',
  'download_started',
  'download_completed',
  'download_failed',
  'install_prompted',
  'install_completed',
  'install_failed',
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clientIp(request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

function truncate(s, max) {
  const t = String(s ?? '');
  return t.length <= max ? t : t.slice(0, max);
}

/**
 * Anonymous client telemetry — no auth. Rate-limited by IP + deviceId.
 */
export async function POST(request) {
  try {
    const len = request.headers.get('content-length');
    if (len && parseInt(len, 10) > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false }, { status: 413 });
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false }, { status: 413 });
    }

    let body;
    try {
      body = JSON.parse(raw || '{}');
    } catch {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const deviceId = String(body.deviceId ?? '').trim();
    if (!UUID_RE.test(deviceId)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const key = telemetryRateLimitKey(clientIp(request), deviceId);
    if (!allowTelemetryPost(key)) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    const eventType = String(body.eventType ?? '').trim();
    if (!ALLOWED_TYPES.has(eventType)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const versionCode = parseInt(String(body.versionCode ?? ''), 10);
    if (!Number.isFinite(versionCode) || versionCode < 0) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const versionName =
      body.versionName != null && body.versionName !== ''
        ? truncate(body.versionName, 64)
        : null;

    let targetVersionCode = null;
    if (body.targetVersionCode !== undefined && body.targetVersionCode !== null) {
      const t = parseInt(String(body.targetVersionCode), 10);
      if (Number.isFinite(t) && t >= 0) targetVersionCode = t;
    }

    let bytesReceived = null;
    let bytesTotal = null;
    if (body.bytesReceived != null) {
      const n = parseInt(String(body.bytesReceived), 10);
      if (Number.isFinite(n) && n >= 0) bytesReceived = Math.min(n, 2_000_000_000);
    }
    if (body.bytesTotal != null) {
      const n = parseInt(String(body.bytesTotal), 10);
      if (Number.isFinite(n) && n >= 0) bytesTotal = Math.min(n, 2_000_000_000);
    }

    const error =
      body.error != null && body.error !== ''
        ? truncate(body.error, 500)
        : null;

    let meta = null;
    if (body.meta != null && typeof body.meta === 'object' && !Array.isArray(body.meta)) {
      try {
        const s = JSON.stringify(body.meta);
        if (s.length <= 4000) meta = body.meta;
      } catch {
        meta = null;
      }
    }

    await prisma.mobileAppClientEvent.create({
      data: {
        eventType,
        deviceId,
        versionCode,
        versionName,
        targetVersionCode,
        bytesReceived,
        bytesTotal,
        error,
        meta,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('mobile-app/telemetry', e);
    return NextResponse.json({ ok: true });
  }
}
