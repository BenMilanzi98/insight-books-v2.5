'use client';

import { adminHasPermission } from '@/lib/admin/permissions';
import { useI18n } from '@/components/i18n/I18nProvider';

/**
 * Client-only UX gate. Server API guards remain authoritative.
 * @param {{ admin: object, permission: string, mode?: 'hide'|'disable', children: React.ReactNode, fallback?: React.ReactNode }} props
 */
export default function AdminPermissionGate({
  admin,
  permission,
  mode = 'hide',
  children,
  fallback = null,
}) {
  const { t } = useI18n();
  const allowed = adminHasPermission(admin, permission);

  if (allowed) return children;

  if (mode === 'disable') {
    return (
      <div
        className="pointer-events-none opacity-50"
        aria-disabled="true"
        title={t('admin-foundation.permission.denied')}
      >
        {children}
      </div>
    );
  }

  return fallback;
}
