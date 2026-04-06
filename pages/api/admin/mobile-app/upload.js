import Busboy from 'busboy';

import { verifyAdminJwtToken } from '@/lib/adminAuth';
import {
  finalizeMobileApkUpload,
  MOBILE_APK_MAX_BYTES,
  publicBaseUrlFromNodeReq,
} from '@/lib/finalizeMobileApkUpload';

/**
 * Pages Router: `bodyParser: false` avoids Next’s default ~1MB body limit on this route.
 * Large APKs still require reverse-proxy limits (e.g. nginx `client_max_body_size`) to allow the stream.
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const admin = await verifyAdminJwtToken(req.cookies?.admin_token);
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  try {
    const payload = await parseMultipartAndSave(req);
    return res.status(200).json(payload);
  } catch (e) {
    const msg = e?.message || 'Upload failed';
    const code =
      msg.includes('too large') ||
      msg.includes('max') ||
      msg.includes('required') ||
      msg.includes('Missing') ||
      msg.includes('look like')
        ? 400
        : 500;
    console.error('admin mobile-app upload (pages api)', e);
    return res.status(code).json({ success: false, error: msg });
  }
}

function parseMultipartAndSave(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: MOBILE_APK_MAX_BYTES },
    });

    const fields = {};
    /** @type {Buffer | null} */
    let fileBuffer = null;
    let fileReceived = false;

    bb.on('field', (name, val) => {
      fields[name] = val;
    });

    bb.on('file', (name, file) => {
      if (name !== 'apk') {
        file.resume();
        return;
      }
      const chunks = [];
      file.on('data', (d) => chunks.push(d));
      file.on('limit', () => {
        reject(
          new Error(`APK too large (max ${MOBILE_APK_MAX_BYTES / (1024 * 1024)} MB)`)
        );
      });
      file.on('error', reject);
      file.on('end', () => {
        fileReceived = true;
        fileBuffer = Buffer.concat(chunks);
      });
    });

    bb.on('error', reject);

    bb.on('finish', async () => {
      try {
        if (!fileBuffer || !fileReceived) {
          reject(new Error('Missing APK file (field name: apk)'));
          return;
        }

        const vCodeRaw = fields.latestVersionCode;
        const latestVersionCode =
          vCodeRaw != null ? parseInt(String(vCodeRaw), 10) : null;
        if (
          latestVersionCode == null ||
          !Number.isFinite(latestVersionCode) ||
          latestVersionCode < 1
        ) {
          reject(new Error('latestVersionCode is required (integer ≥ 1)'));
          return;
        }

        const vNameRaw = fields.latestVersionName;
        const latestVersionName =
          vNameRaw != null && String(vNameRaw).trim()
            ? String(vNameRaw).trim()
            : String(latestVersionCode);

        const publish = fields.publish === 'true' || fields.publish === '1';
        const lockRaw = fields.websiteDownloadLocked;
        const websiteDownloadLocked =
          lockRaw === 'true' || lockRaw === '1' || lockRaw === 'on';

        const publicBaseUrl = publicBaseUrlFromNodeReq(req);

        const { RELEASE_APK_FILENAME, bufferLength, row } =
          await finalizeMobileApkUpload({
            buffer: fileBuffer,
            latestVersionCode,
            latestVersionName,
            publish,
            websiteDownloadLocked,
            publicBaseUrl,
          });

        resolve({
          success: true,
          message: `Saved ${RELEASE_APK_FILENAME} (${(bufferLength / (1024 * 1024)).toFixed(2)} MB)`,
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
      } catch (err) {
        reject(err);
      }
    });

    req.pipe(bb);
  });
}
