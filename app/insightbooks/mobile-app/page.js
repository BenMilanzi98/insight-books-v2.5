'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function defaultDateRange() {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/** ISO UTC → value for `<input type="datetime-local">` in the browser's local timezone. */
function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MobileAppManagementPage() {
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [releaseFile, setReleaseFile] = useState({ exists: false });
  const [form, setForm] = useState({
    latestVersionCode: 1,
    latestVersionName: '1.0.0',
    apkDownloadUrl: '',
    releaseNotes: '',
    gracePeriodHours: 24,
    gracePeriodMinutes: '',
    graceEndsAtLocal: '',
    forceLock: false,
    websiteDownloadLocked: false,
    broadcastMessage: '',
    maintenanceLock: false,
    maintenanceMessage: '',
  });
  const [analyticsRange, setAnalyticsRange] = useState(defaultDateRange);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [publishedAt, setPublishedAt] = useState(null);
  const [uploadOpts, setUploadOpts] = useState({
    publishOnUpload: false,
    lockWebsiteOnUpload: false,
  });
  const [previewVc, setPreviewVc] = useState('');
  const [previewJson, setPreviewJson] = useState(null);
  const [previewErr, setPreviewErr] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/mobile-app', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const c = data.config;
      setForm({
        latestVersionCode: c.latestVersionCode,
        latestVersionName: c.latestVersionName || '',
        apkDownloadUrl: c.apkDownloadUrl || '',
        releaseNotes: c.releaseNotes || '',
        gracePeriodHours: c.gracePeriodHours ?? 24,
        gracePeriodMinutes:
          c.gracePeriodMinutes != null && Number.isFinite(Number(c.gracePeriodMinutes))
            ? String(c.gracePeriodMinutes)
            : '',
        graceEndsAtLocal: toDatetimeLocalValue(c.graceEndsAt),
        forceLock: !!c.forceLock,
        websiteDownloadLocked: !!c.websiteDownloadLocked,
        broadcastMessage: c.broadcastMessage || '',
        maintenanceLock: !!c.maintenanceLock,
        maintenanceMessage: c.maintenanceMessage || '',
      });
      setPublishedAt(c.publishedAt || null);
      setReleaseFile(data.releaseFile || { exists: false });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const q = new URLSearchParams({
        from: analyticsRange.from,
        to: analyticsRange.to,
      });
      const res = await fetch(`/api/admin/mobile-app/analytics?${q}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load analytics');
      setAnalytics(data);
    } catch (e) {
      setAnalyticsError(e.message);
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsRange.from, analyticsRange.to]);

  useEffect(() => {
    if (!loading) loadAnalytics();
  }, [loading, loadAnalytics]);

  const save = async (extra = {}) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/mobile-app', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latestVersionCode: form.latestVersionCode,
          latestVersionName: form.latestVersionName,
          apkDownloadUrl: form.apkDownloadUrl,
          releaseNotes: form.releaseNotes || null,
          gracePeriodHours: form.gracePeriodHours,
          gracePeriodMinutes:
            form.gracePeriodMinutes === '' || form.gracePeriodMinutes == null
              ? null
              : parseInt(String(form.gracePeriodMinutes), 10),
          graceEndsAt:
            form.graceEndsAtLocal && String(form.graceEndsAtLocal).trim()
              ? new Date(form.graceEndsAtLocal).toISOString()
              : null,
          forceLock: form.forceLock,
          websiteDownloadLocked: form.websiteDownloadLocked,
          broadcastMessage: form.broadcastMessage || null,
          maintenanceLock: form.maintenanceLock,
          maintenanceMessage: form.maintenanceMessage?.trim() || null,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setPublishedAt(data.config.publishedAt || null);
      if (data.releaseFile) setReleaseFile(data.releaseFile);
      setMessage({ type: 'success', text: 'Saved.' });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const runPolicyPreview = async () => {
    const n = parseInt(String(previewVc).trim(), 10);
    if (!Number.isFinite(n) || n < 0) {
      setPreviewErr('Enter a valid device version code (0 or higher — same as Flutter build number after +).');
      setPreviewJson(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewErr(null);
    setPreviewJson(null);
    try {
      const res = await fetch(`/api/mobile-app/version?versionCode=${n}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Request failed');
      setPreviewJson(j);
    } catch (e) {
      setPreviewErr(e.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const uploadApk = async () => {
    const input = fileInputRef.current;
    const file = input?.files?.[0];
    if (!file) {
      setMessage({ type: 'error', text: 'Choose an APK file first.' });
      return;
    }
    if (!String(file.name).toLowerCase().endsWith('.apk')) {
      setMessage({ type: 'error', text: 'File must be a .apk' });
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('apk', file);
      fd.append('latestVersionCode', String(form.latestVersionCode));
      fd.append('latestVersionName', form.latestVersionName || String(form.latestVersionCode));
      if (uploadOpts.publishOnUpload) fd.append('publish', 'true');
      if (uploadOpts.lockWebsiteOnUpload) fd.append('websiteDownloadLocked', 'true');

      const res = await fetch('/api/admin/mobile-app/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setForm((f) => ({
        ...f,
        latestVersionCode: data.config.latestVersionCode,
        latestVersionName: data.config.latestVersionName,
        apkDownloadUrl: data.config.apkDownloadUrl,
        websiteDownloadLocked: !!data.config.websiteDownloadLocked,
      }));
      setPublishedAt(data.config.publishedAt || null);
      await load();
      setMessage({ type: 'success', text: data.message || 'APK uploaded.' });
      if (input) input.value = '';
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const fmtSize = (n) => {
    if (n == null) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Android app</h1>
        <p className="text-gray-600 mt-1">
          Upload the release APK directly to this server, control public downloads with{' '}
          <strong>instant lock</strong>, set grace / force-lock for in-app updates, and broadcast
          messages. Public version check:{' '}
          <code className="text-sm bg-gray-100 px-1 rounded">GET /api/mobile-app/version?versionCode=1</code>
        </p>
        <p className="text-sm text-gray-500 mt-2">
          User-facing download page:{' '}
          <a href="/download-app" className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">
            /download-app
          </a>{' '}
          · Direct APK URL:{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">/api/mobile-app/download</code>
        </p>
        <p className="text-sm text-gray-600 mt-2 border-l-4 border-gray-300 pl-3">
          <strong>Telemetry:</strong> the Android app sends anonymous events (random device ID, build
          number, funnel steps) to <code className="text-xs bg-gray-100 px-1">POST /api/mobile-app/telemetry</code>
          . No accounts or personal data are included. In-app APK install uses sideloading (not Google
          Play); if you later publish on Play, in-app APK installs are restricted by store policy.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-md px-4 py-2 text-sm ${
            message.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6 space-y-4 border border-gray-200 border-l-4 border-l-indigo-500">
        <h2 className="text-lg font-semibold text-gray-900">Upload APK to website</h2>
        <p className="text-sm text-gray-600">
          Saves to <code className="text-xs bg-gray-100 px-1">public/releases/insight-books-android.apk</code>.
          Max ~250 MB. If uploads fail with <strong>413</strong>, raise limits in front of Node (e.g. nginx{' '}
          <code className="text-xs bg-gray-100 px-1">client_max_body_size 300m;</code> for this location) and
          check Cloudflare / load balancer body limits.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-gray-700">APK file</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-indigo-50 file:text-indigo-700"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={uploadOpts.publishOnUpload}
              onChange={(e) =>
                setUploadOpts((o) => ({ ...o, publishOnUpload: e.target.checked }))
              }
            />
            <span>Start grace period on upload (set publish time to now)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={uploadOpts.lockWebsiteOnUpload}
              onChange={(e) =>
                setUploadOpts((o) => ({ ...o, lockWebsiteOnUpload: e.target.checked }))
              }
            />
            <span className="text-amber-800">
              Lock website download immediately after upload (users cannot download until you unlock)
            </span>
          </label>
        </div>

        <button
          type="button"
          disabled={uploading}
          onClick={uploadApk}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload APK'}
        </button>

        <div className="text-sm text-gray-600 border-t pt-4">
          <strong>File on server:</strong>{' '}
          {releaseFile.exists ? (
            <>
              yes · {fmtSize(releaseFile.size)}
              {releaseFile.mtime && (
                <> · updated {new Date(releaseFile.mtime).toLocaleString()}</>
              )}
            </>
          ) : (
            'none'
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 space-y-4 border border-gray-200 border-l-4 border-l-rose-500">
        <h2 className="text-lg font-semibold text-gray-900">Emergency maintenance</h2>
        <p className="text-sm text-gray-600">
          <strong>Maintenance</strong> locks <em>every</em> install at once (full-screen block).{' '}
          <strong>Force lock</strong> below only affects devices that are still on an older{' '}
          <code className="text-xs bg-gray-100 px-1">versionCode</code> than your latest published
          build.
        </p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.maintenanceLock}
            onChange={(e) => setForm((f) => ({ ...f, maintenanceLock: e.target.checked }))}
          />
          <span className="text-sm font-medium text-rose-900">Enable maintenance lock now</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Message shown in the app (optional)</span>
          <textarea
            className="mt-1 w-full border rounded-md px-3 py-2 min-h-[72px]"
            placeholder="e.g. We are upgrading servers. Please try again in 30 minutes."
            value={form.maintenanceMessage}
            onChange={(e) => setForm((f) => ({ ...f, maintenanceMessage: e.target.value }))}
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => save()}
          className="px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50"
        >
          Save maintenance settings
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6 space-y-4 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Version & URLs</h2>
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          <p className="font-medium text-sky-900">How in-app locking works</p>
          <ul className="mt-2 list-disc list-inside space-y-1.5 text-sky-900/90">
            <li>
              <strong>Force lock</strong> and <strong>grace</strong> only affect devices whose{' '}
              <strong>installed</strong> Android <code className="text-xs bg-white/80 px-1 rounded">versionCode</code>{' '}
              is <strong>strictly lower</strong> than <strong>Latest version code</strong> below. In Flutter
              that is the number after <code className="text-xs bg-white/80 px-1 rounded">+</code> in{' '}
              <code className="text-xs bg-white/80 px-1 rounded">pubspec.yaml</code> (e.g.{' '}
              <code className="text-xs bg-white/80 px-1 rounded">1.0.0+2</code> → code <strong>2</strong>).
            </li>
            <li>
              If <strong>Latest version code</strong> is the same as (or below) a device&apos;s build
              number, the app is considered up to date — <strong>no full-screen lock</strong>, even with
              Force lock enabled.
            </li>
            <li>
              <strong>Lock website APK</strong> only disables this site&apos;s hosted APK URL; it{' '}
              <strong>does not</strong> show the lock overlay by itself. To block everyone immediately, use{' '}
              <strong>Emergency maintenance</strong> above.
            </li>
          </ul>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Latest version code (integer)</span>
            <input
              type="number"
              min={1}
              className="mt-1 w-full border rounded-md px-3 py-2"
              value={form.latestVersionCode}
              onChange={(e) =>
                setForm((f) => ({ ...f, latestVersionCode: parseInt(e.target.value, 10) || 1 }))
              }
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Latest version name</span>
            <input
              type="text"
              className="mt-1 w-full border rounded-md px-3 py-2"
              value={form.latestVersionName}
              onChange={(e) => setForm((f) => ({ ...f, latestVersionName: e.target.value }))}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">APK download URL (site or external)</span>
          <input
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://… (files.fm, Drive, CDN, Play Store, etc.)"
            className="mt-1 w-full border rounded-md px-3 py-2 font-mono text-sm"
            value={form.apkDownloadUrl}
            onChange={(e) => setForm((f) => ({ ...f, apkDownloadUrl: e.target.value }))}
          />
          <span className="text-xs text-gray-500">
            Use any <strong>https</strong> link to the APK (or <strong>http</strong> if you must). When
            &quot;Lock website APK&quot; is on, the app still gets this URL if it is <em>not</em> this
            site&apos;s <code>/api/mobile-app/download</code>. After upload without an override, this
            field is set to the site download URL.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Release notes</span>
          <textarea
            className="mt-1 w-full border rounded-md px-3 py-2 min-h-[80px]"
            value={form.releaseNotes}
            onChange={(e) => setForm((f) => ({ ...f, releaseNotes: e.target.value }))}
          />
        </label>

        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-amber-900">Instant lock — website download</h3>
          <p className="text-xs text-amber-900/90">
            When enabled, <code>/api/mobile-app/download</code> and the public{' '}
            <code>/download-app</code> page stop offering the site-hosted APK. The Android app still
            receives an <strong>external</strong> URL from &quot;APK download URL&quot; below if you set
            one (not the same as this site&apos;s <code>/api/mobile-app/download</code>). This does not
            change &quot;Force lock&quot; for outdated installs.
          </p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.websiteDownloadLocked}
              onChange={(e) => setForm((f) => ({ ...f, websiteDownloadLocked: e.target.checked }))}
            />
            <span className="text-sm font-medium text-amber-950">Lock website APK download now</span>
          </label>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Grace window (outdated installs)</h3>
          <p className="text-xs text-gray-600">
            <strong>Fixed deadline</strong> wins over duration. Duration uses <strong>minutes</strong> if
            set, otherwise <strong>hours</strong> after <em>Publish</em>. Requires an outdated app (
            <code className="text-xs bg-white px-1 rounded">versionCode</code> below latest) unless you use
            Force lock.
          </p>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Lock outdated installs after (local date &amp; time)
            </span>
            <input
              type="datetime-local"
              className="mt-1 w-full max-w-md border rounded-md px-3 py-2"
              value={form.graceEndsAtLocal}
              onChange={(e) => setForm((f) => ({ ...f, graceEndsAtLocal: e.target.value }))}
            />
            <span className="text-xs text-gray-500">
              Leave empty to use duration from publish instead. Cleared when you clear publish time.
            </span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Grace duration — minutes (optional)</span>
              <input
                type="number"
                min={0}
                max={525600}
                placeholder="e.g. 90"
                className="mt-1 w-full border rounded-md px-3 py-2"
                value={form.gracePeriodMinutes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, gracePeriodMinutes: e.target.value }))
                }
              />
              <span className="text-xs text-gray-500">
                If set (0 allowed), counted from <strong>Published at</strong> when fixed deadline above is
                empty. Max 525600 (364 days). Leave empty to use hours only.
              </span>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Grace duration — hours (fallback)</span>
              <input
                type="number"
                min={0}
                max={8760}
                className="mt-1 w-full border rounded-md px-3 py-2"
                value={form.gracePeriodHours}
                onChange={(e) =>
                  setForm((f) => ({ ...f, gracePeriodHours: parseInt(e.target.value, 10) || 0 }))
                }
              />
              <span className="text-xs text-gray-500">
                Used only when <strong>minutes</strong> is empty and <strong>fixed deadline</strong> is
                empty.
              </span>
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.forceLock}
              onChange={(e) => setForm((f) => ({ ...f, forceLock: e.target.checked }))}
            />
            <span className="text-sm font-medium text-gray-700">
              Force lock outdated apps only (ignore grace)
            </span>
          </label>
          <p className="text-xs text-gray-500 -mt-2">
            Outdated means: installed <code className="text-xs bg-white px-1 rounded">versionCode</code>{' '}
            &lt; Latest version code. Raise Latest above installed builds, save, then test on a device.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Live policy preview</h3>
          <p className="text-xs text-gray-600">
            Calls the same public endpoint as the Android app:{' '}
            <code className="text-xs bg-white px-1 rounded">GET /api/mobile-app/version?versionCode=…</code>.
            Use the build number from an installed APK to see why it does or does not get{' '}
            <code className="text-xs bg-white px-1 rounded">mustLock</code>.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block text-sm">
              <span className="text-gray-600">Device versionCode</span>
              <input
                type="number"
                min={0}
                className="mt-1 border rounded-md px-2 py-1 w-36 block bg-white"
                value={previewVc}
                onChange={(e) => setPreviewVc(e.target.value)}
                placeholder="e.g. 2"
              />
            </label>
            <button
              type="button"
              disabled={previewLoading}
              onClick={runPolicyPreview}
              className="px-3 py-2 bg-slate-700 text-white rounded-md text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {previewLoading ? 'Loading…' : 'Preview'}
            </button>
          </div>
          {previewErr && <p className="text-sm text-red-600">{previewErr}</p>}
          {previewJson && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm font-mono bg-white rounded border border-gray-200 p-3">
              <dt className="text-gray-500">mustLock</dt>
              <dd>{String(previewJson.mustLock)}</dd>
              <dt className="text-gray-500">updateAvailable</dt>
              <dd>{String(previewJson.updateAvailable)}</dd>
              <dt className="text-gray-500">maintenance</dt>
              <dd>{String(previewJson.maintenance)}</dd>
              <dt className="text-gray-500">latestVersionCode</dt>
              <dd>{String(previewJson.latestVersionCode)}</dd>
              <dt className="text-gray-500 sm:col-span-1">graceEndsAt</dt>
              <dd className="sm:col-span-1 break-all">{previewJson.graceEndsAt == null ? 'null' : String(previewJson.graceEndsAt)}</dd>
            </dl>
          )}
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">In-app broadcast message (optional)</span>
          <textarea
            className="mt-1 w-full border rounded-md px-3 py-2 min-h-[60px]"
            placeholder="Shown on next version check in the Android app"
            value={form.broadcastMessage}
            onChange={(e) => setForm((f) => ({ ...f, broadcastMessage: e.target.value }))}
          />
        </label>

        <div className="text-sm text-gray-600">
          <strong>Published at:</strong>{' '}
          {publishedAt ? new Date(publishedAt).toLocaleString() : '— (not published — timed lock inactive)'}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => save()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            Save settings
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => save({ publish: true })}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            Save &amp; publish (start grace)
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => save({ clearPublish: true })}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50"
          >
            Clear publish time
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 space-y-4 border border-gray-200 border-l-4 border-l-slate-500">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Client analytics</h2>
            <p className="text-sm text-gray-600 mt-1">
              Distinct devices, version checks, and OTA funnel from anonymous telemetry.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block text-sm">
              <span className="text-gray-600">From</span>
              <input
                type="date"
                className="mt-1 border rounded-md px-2 py-1 block"
                value={analyticsRange.from}
                onChange={(e) =>
                  setAnalyticsRange((r) => ({ ...r, from: e.target.value }))
                }
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">To</span>
              <input
                type="date"
                className="mt-1 border rounded-md px-2 py-1 block"
                value={analyticsRange.to}
                onChange={(e) =>
                  setAnalyticsRange((r) => ({ ...r, to: e.target.value }))
                }
              />
            </label>
            <button
              type="button"
              disabled={analyticsLoading}
              onClick={() => loadAnalytics()}
              className="px-3 py-2 bg-slate-700 text-white rounded-md text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {analyticsLoading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {analyticsError && (
          <div className="rounded-md px-4 py-2 text-sm bg-red-50 text-red-800">{analyticsError}</div>
        )}

        {analytics?.summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Unique devices', value: analytics.summary.uniqueDevices },
              { label: 'Version checks', value: analytics.summary.versionCheckCount },
              { label: 'Downloads OK', value: analytics.summary.downloadCompleted },
              { label: 'Download failed', value: analytics.summary.downloadFailed },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-lg border border-gray-200 bg-slate-50 px-3 py-3"
              >
                <div className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</div>
                <div className="text-2xl font-semibold text-gray-900 mt-1">{c.value}</div>
              </div>
            ))}
          </div>
        )}

        {analytics?.funnel && (
          <p className="text-sm text-gray-600">
            Funnel: {analytics.funnel.versionChecks} checks → {analytics.funnel.downloadStarted}{' '}
            started → {analytics.funnel.downloadCompleted} completed
            {analytics.summary?.funnelConversion != null && (
              <> ({analytics.summary.funnelConversion}% completed / checks)</>
            )}
            . Install prompts: {analytics.funnel.installPrompted}.
          </p>
        )}

        {analytics?.dauByDay?.length > 0 && (
          <div className="h-64 w-full">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Daily active devices (version_check, UTC day)
            </p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.dauByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="dau" name="Devices" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {analytics?.recentEvents?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Recent events (newest first)</h3>
            <div className="overflow-x-auto border rounded-md">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-3 py-2">Time (UTC)</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Device</th>
                    <th className="px-3 py-2">vCode</th>
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.recentEvents.map((ev) => (
                    <tr key={ev.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(ev.createdAt).toISOString().slice(0, 19).replace('T', ' ')}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{ev.eventType}</td>
                      <td className="px-3 py-2 font-mono text-xs">{ev.deviceId}</td>
                      <td className="px-3 py-2">{ev.versionCode}</td>
                      <td className="px-3 py-2">{ev.targetVersionCode ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-red-700 max-w-[200px] truncate">
                        {ev.error || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!analyticsLoading && analytics && !analytics.recentEvents?.length && (
          <p className="text-sm text-gray-500">No events in this range yet.</p>
        )}
      </div>
    </div>
  );
}
