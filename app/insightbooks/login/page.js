'use client';

import { adminFetch } from '@/lib/admin/adminApi';

import { useState } from 'react';
import { AlertCircle, CheckCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await adminFetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const raw = await response.text();
      let data = { success: false };
      try {
        if (raw) data = JSON.parse(raw);
      } catch {
        data = {
          success: false,
          error:
            response.status >= 500
              ? `Server error (${response.status}). Please try again or contact support.`
              : `Request failed (${response.status}).`,
        };
      }

      if (data.success) {
        setSuccess('Login successful. Redirecting…');
        setTimeout(() => {
          window.location.href = '/insightbooks/dashboard';
        }, 500);
      } else {
        const hint =
          typeof data.details === 'string' && data.details.trim()
            ? ` (${data.details.trim()})`
            : '';
        const base =
          data.error
          || (response.status === 503
            ? 'Service unavailable. The server may be missing JWT configuration.'
            : 'Login failed');
        setError(base + hint);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--admin-bg,#f8fafc)] text-[var(--admin-text,#0f172a)]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row">
        <aside className="relative flex flex-1 flex-col justify-between overflow-hidden bg-slate-900 px-8 py-10 text-slate-50 lg:max-w-md lg:px-10">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                'radial-gradient(ellipse at 20% 0%, rgba(148,163,184,0.35), transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(71,85,105,0.45), transparent 50%)',
            }}
            aria-hidden
          />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[var(--admin-radius,0.5rem)] bg-white text-lg font-bold text-slate-900">
                IB
              </div>
              <div>
                <p className="text-xl font-semibold tracking-tight">InsightBooks</p>
                <p className="text-sm text-slate-300">Admin portal</p>
              </div>
            </div>
            <p className="mt-10 max-w-sm text-sm leading-relaxed text-slate-300">
              Calm operations console for tenants, billing, affiliates, and platform health.
            </p>
          </div>
          <p className="relative text-xs text-slate-400">
            © InsightBooks — system administration
          </p>
        </aside>

        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--admin-radius,0.5rem)] bg-slate-900 text-sm font-bold text-white">
                  IB
                </div>
                <div>
                  <p className="text-lg font-semibold">InsightBooks</p>
                  <p className="text-sm text-[var(--admin-text-muted,#64748b)]">Admin portal</p>
                </div>
              </div>
            </div>

            <div className="rounded-[var(--admin-radius,0.5rem)] border border-[var(--admin-border,#e2e8f0)] bg-[var(--admin-surface,#fff)] p-6 shadow-sm sm:p-8">
              <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
              <p className="mt-1 text-sm text-[var(--admin-text-muted,#64748b)]">
                Access the system administration panel
              </p>

              {error ? (
                <div className="mt-4 flex items-start gap-2 rounded-[var(--admin-radius,0.5rem)] border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              ) : null}

              {success ? (
                <div className="mt-4 flex items-start gap-2 rounded-[var(--admin-radius,0.5rem)] border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900" role="status">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{success}</span>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                    Admin email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-text-muted,#64748b)]" aria-hidden />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 w-full rounded-[var(--admin-radius,0.5rem)] border border-[var(--admin-border,#e2e8f0)] bg-white py-2 pl-9 pr-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus-ring,#334155)]"
                      placeholder="admin@example.com"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-text-muted,#64748b)]" aria-hidden />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 w-full rounded-[var(--admin-radius,0.5rem)] border border-[var(--admin-border,#e2e8f0)] bg-white py-2 pl-9 pr-10 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus-ring,#334155)]"
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--admin-text-muted,#64748b)] hover:text-[var(--admin-text,#0f172a)]"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex h-11 w-full items-center justify-center rounded-[var(--admin-radius,0.5rem)] bg-[var(--action-primary,#0f172a)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {isLoading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
