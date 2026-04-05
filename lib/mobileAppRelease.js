import fs from 'fs';
import path from 'path';

/** Fixed filename for the APK served at /api/mobile-app/download */
export const RELEASE_APK_FILENAME = 'insight-books-android.apk';

export function getReleaseApkPath() {
  return path.join(process.cwd(), 'public', 'releases', RELEASE_APK_FILENAME);
}

export function releaseApkExists() {
  try {
    const p = getReleaseApkPath();
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

export function getReleaseApkStats() {
  try {
    const p = getReleaseApkPath();
    if (!fs.existsSync(p)) return null;
    const st = fs.statSync(p);
    return { size: st.size, mtime: st.mtime };
  } catch {
    return null;
  }
}

/** Infer public base URL from request (for absolute apkDownloadUrl in API responses). */
export function publicBaseUrlFromRequest(request) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host) return (envUrl || '').replace(/\/$/, '');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`.replace(/\/$/, '');
}
