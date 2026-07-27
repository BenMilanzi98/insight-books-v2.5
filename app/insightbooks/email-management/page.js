'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import EnhancedEmailManagement from '@/components/EnhancedEmailManagement';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
} from '@/components/admin';

const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white';

export default function AdminEmailManagementPage() {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = async () => {
    try {
      const response = await fetch('/api/admin/auth/me');
      const data = await response.json();

      if (response.ok) {
        setAdmin(data.admin);
      } else {
        setError('Unauthorized access');
        router.push('/insightbooks/login');
      }
    } catch (err) {
      console.error('Error checking admin auth:', err);
      setError('Authentication error');
      router.push('/insightbooks/login');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminPageContainer>
        <AdminLoadingState label="Checking admin access" />
      </AdminPageContainer>
    );
  }

  if (error) {
    return (
      <AdminPageContainer>
        <AdminErrorState
          title="Access denied"
          message={error}
          onRetry={() => router.push('/insightbooks/login')}
        />
        <div className="mt-4">
          <button type="button" onClick={() => router.push('/insightbooks/login')} className={btnPrimary}>
            Go to Login
          </button>
        </div>
      </AdminPageContainer>
    );
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Email Management"
        description="Send emails to users across all tenants"
        actions={
          <span className="text-sm text-[var(--admin-text-muted)]">
            Welcome, {admin?.name || 'Admin'}
          </span>
        }
      />
      <EnhancedEmailManagement />
    </AdminPageContainer>
  );
}
