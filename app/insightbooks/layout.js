"use client";
import { tt } from '@/lib/i18n/runtime';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import AdminShell from '@/components/shell/AdminShell';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const [admin, setAdmin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const isLoginPage = pathname === '/insightbooks/login';

  useEffect(() => {
    if (pathname === '/insightbooks/login') {
      setIsLoading(false);
      return;
    }
    if (pathname && pathname.startsWith('/insightbooks')) {
      checkAuth();
    } else {
      setIsLoading(false);
    }
  }, [pathname]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/auth/me', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setAdmin(data.admin);
      } else {
        window.location.replace('/insightbooks/login');
        return;
      }
    } catch (error) {
      window.location.replace('/insightbooks/login');
      return;
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background-secondary)]">
        <div
          className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--action-primary)]"
          role="status"
          aria-label={tt('Loading')}
        />
      </div>
    );
  }

  if (!admin) {
    if (typeof window !== 'undefined' && pathname !== '/insightbooks/login') {
      window.location.replace('/insightbooks/login');
    }
    return null;
  }

  return <AdminShell admin={admin}>{children}</AdminShell>;
}
