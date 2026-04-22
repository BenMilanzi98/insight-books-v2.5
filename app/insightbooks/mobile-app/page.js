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
          <span className="text-sm font-medium text-gray-700">APK download URL (fallback / external)</span>
          <input
            type="url"
            placeholder="Optional if APK is hosted on this site"
            className="mt-1 w-full border rounded-md px-3 py-2"
            value={form.apkDownloadUrl}
            onChange={(e) => setForm((f) => ({ ...f, apkDownloadUrl: e.target.value }))}
          />
          <span className="text-xs text-gray-500">
            After upload, this is set to this site&apos;s <code>/api/mobile-app/download</code>. You can
            override with an external CDN URL if needed.
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Grace period (hours)</span>
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
            <span className="text-xs text-gray-500">After publish, users have this long to update before lock.</span>
          </label>
          <label className="flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              checked={form.forceLock}
              onChange={(e) => setForm((f) => ({ ...f, forceLock: e.target.checked }))}
            />
            <span className="text-sm font-medium text-gray-700">
              Force lock outdated apps only (ignore grace)
            </span>
          </label>
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
