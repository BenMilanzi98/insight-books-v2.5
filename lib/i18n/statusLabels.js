import { translate } from './t.js';

const STATUS_KEY_MAP = {
  DRAFT: 'common.status.draft',
  PENDING: 'common.status.pending',
  PENDING_APPROVAL: 'common.status.pendingApproval',
  APPROVED: 'common.status.approved',
  REJECTED: 'common.status.rejected',
  ACTIVE: 'common.status.active',
  INACTIVE: 'common.status.inactive',
  POSTED: 'common.status.posted',
  UNPOSTED: 'common.status.unposted',
  PAID: 'common.status.paid',
  UNPAID: 'common.status.unpaid',
  PARTIALLY_PAID: 'common.status.partiallyPaid',
  OVERDUE: 'common.status.overdue',
  COMPLETED: 'common.status.completed',
  FAILED: 'common.status.failed',
  CANCELLED: 'common.status.cancelled',
  CANCELED: 'common.status.cancelled',
  REVERSED: 'common.status.reversed',
  ARCHIVED: 'common.status.archived',
  OPEN: 'common.status.open',
  CLOSED: 'common.status.closed',
  PROCESSING: 'common.status.processing',
};

export function translateStatus(status, { locale, messages, englishMessages } = {}) {
  const code = String(status || '').toUpperCase();
  const key = STATUS_KEY_MAP[code];
  if (!key) return String(status || '');
  return translate({ key, locale, messages, englishMessages });
}

export function canonicalStatus(status) {
  return String(status || '').toUpperCase();
}
