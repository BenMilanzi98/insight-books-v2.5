'use client';

import { useEffect, useState } from 'react';

export default function MobileAppManagementPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({
    latestVersionCode: 1,
    latestVersionName: '1.0.0',
    apkDownloadUrl: '',
    releaseNotes: '',
    gracePeriodHours: 24,
    forceLock: false,
    broadcastMessage: '',
  });
  const [publishedAt, setPublishedAt] = useState(null);

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
        broadcastMessage: c.broadcastMessage || '',
      });
      setPublishedAt(c.publishedAt || null);
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
          broadcastMessage: form.broadcastMessage || null,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setPublishedAt(data.config.publishedAt || null);
      setMessage({ type: 'success', text: 'Saved.' });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Android app</h1>
        <p className="text-gray-600 mt-1">
          Publish APK updates, set a grace period (default 24 hours), optionally force-lock outdated
          clients, and broadcast a message to the app. Public check:{' '}
          <code className="text-sm bg-gray-100 px-1 rounded">GET /api/mobile-app/version?versionCode=1</code>
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

      <div className="bg-white shadow rounded-lg p-6 space-y-4 border border-gray-200">
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
          <span className="text-sm font-medium text-gray-700">APK download URL</span>
          <input
            type="url"
            placeholder="https://your-domain.com/path/app-release.apk"
            className="mt-1 w-full border rounded-md px-3 py-2"
            value={form.apkDownloadUrl}
            onChange={(e) => setForm((f) => ({ ...f, apkDownloadUrl: e.target.value }))}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Release notes</span>
          <textarea
            className="mt-1 w-full border rounded-md px-3 py-2 min-h-[80px]"
            value={form.releaseNotes}
            onChange={(e) => setForm((f) => ({ ...f, releaseNotes: e.target.value }))}
          />
        </label>

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
            <span className="text-sm font-medium text-gray-700">Force lock (ignore grace)</span>
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
