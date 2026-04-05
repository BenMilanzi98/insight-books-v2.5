'use client';

import { useEffect, useState, useRef } from 'react';

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
  });
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
    <div className="max-w-3xl mx-auto p-6 space-y-6">
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
          Max ~250 MB. Self‑hosted / Node may need reverse proxy limits adjusted for large uploads.
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
            <code>/download-app</code> page stop offering the APK immediately. In-app version JSON also
            omits the URL. This does not change the separate &quot;Force lock&quot; behavior for outdated
            app installs.
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
            <span className="text-sm font-medium text-gray-700">Force lock outdated apps (ignore grace)</span>
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
    </div>
  );
}
