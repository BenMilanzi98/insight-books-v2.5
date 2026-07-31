'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';

/** EMAIL / WHATSAPP show NOT_AVAILABLE; never invent channel volume. */
export default function CrmChannelBadge({ channel }) {
  const { t } = useI18n();
  const ch = String(channel || 'ADMIN_MANUAL').toUpperCase();
  if (ch === 'EMAIL' || ch === 'WHATSAPP') {
    return (
      <AdminStatusBadge tone="warning">
        {`${ch} (${t('admin-pages.crm.channelNotAvailable')})`}
      </AdminStatusBadge>
    );
  }
  return <AdminStatusBadge tone="neutral">{ch}</AdminStatusBadge>;
}
