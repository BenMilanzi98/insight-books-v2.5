'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Visible banner when a System Administrator has an active support-access session.
 */
export default function AdminSupportAccessBanner() {
  const [session, setSession] = useState(null);
  const [ending, setEnding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/support-access?status=ACTIVE', {
        credentials: 'include',
      });
      if (!res.ok) return;
      const body = await res.json().catch(() => ({}));
      const list = body.sessions || body.items || [];
      const active = Array.isArray(list) ? list.find((s) => s.status === 'ACTIVE') : null;
      setSession(active || null);
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const endSession = async () => {
    if (!session?.id) return;
    setEnding(true);
    try {
      await fetch('/api/admin/support-access', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end', sessionId: session.id, endReason: 'Manual exit' }),
      });
      setSession(null);
    } finally {
      setEnding(false);
    }
  };

  if (!session) return null;

  return (
    <div
      className="mb-4 flex flex-col gap-2 rounded-[var(--radius-lg)] border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 sm:flex-row sm:items-center sm:justify-between"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0 text-sm">
          <strong>Support Access Active</strong>
          <span className="block truncate sm:inline sm:before:content-['_|_']">
            Tenant {session.tenantId}
            {session.expiresAt ? ` · expires ${new Date(session.expiresAt).toLocaleString()}` : ''}
          </span>
          <span className="block text-xs text-amber-900/80">
            Real actor remains your System Administrator identity. All actions are audited.
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={endSession}
        disabled={ending}
        className="shrink-0 rounded-[var(--radius-md)] bg-amber-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-900 disabled:opacity-60"
      >
        {ending ? 'Ending…' : 'Exit support access'}
      </button>
    </div>
  );
}
