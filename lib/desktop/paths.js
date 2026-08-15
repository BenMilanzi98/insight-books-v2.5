const OPERATIONAL_PREFIXES = [
  '/api/sales',
  '/api/pos',
  '/api/invoices',
  '/api/clients',
  '/api/stock',
  '/api/payments',
];

const AUTH_OK_PATHS = [
  '/api/auth/me',
  '/api/auth/logout',
  '/api/preferences/language',
  '/api/auth/page-guard',
  '/api/auth/api-guard',
];

const DESKTOP_CLOUD_PATHS = [
  '/api/desktop/bind',
  '/api/desktop/unbind',
  '/api/desktop/snapshot',
  '/api/desktop/outbox',
  '/api/desktop/heartbeat',
];

const ONLINE_ONLY_PREFIXES = [
  '/api/invoices/upload',
  '/api/invoices/export',
  '/api/clients/send-email',
  '/api/clients/bulk-upload',
  '/api/clients/template',
  '/api/stock/receiving',
  '/api/stock/basic-import',
  '/api/stock/export',
  '/api/stock/upload-image',
  '/api/stock/basic-export',
  '/api/payments/export',
  '/api/payments/sync',
  '/api/sales/export',
  '/api/sales/receipts/export',
  '/api/pos/cash-day/export',
  '/api/pos/cash-day/deposit',
];

const ONLINE_ONLY_PATTERNS = [
  /^\/api\/invoices\/[^/]+\/send(?:\/|$)/,
  /^\/api\/invoices\/[^/]+\/download(?:\/|$)/,
  /^\/api\/invoices\/[^/]+\/attachments(?:\/|$)/,
  /^\/api\/clients\/[^/]+\/balance-reminder(?:\/|$)/,
];

function matchesPrefix(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function classifyDesktopApiPath(pathname) {
  if (
    ONLINE_ONLY_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix)) ||
    ONLINE_ONLY_PATTERNS.some((pattern) => pattern.test(pathname))
  ) {
    return 'online-only';
  }

  if (DESKTOP_CLOUD_PATHS.some((path) => matchesPrefix(pathname, path))) {
    return 'desktop-cloud';
  }

  if (matchesPrefix(pathname, '/api/desktop-local')) {
    return 'desktop-local';
  }

  if (AUTH_OK_PATHS.includes(pathname)) {
    return 'auth-ok';
  }

  if (OPERATIONAL_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
    return 'operational';
  }

  return 'online-only';
}
