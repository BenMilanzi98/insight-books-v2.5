/**
 * Platform global settings helpers — mask secrets on read; keep on empty write.
 */

export const SECRET_SETTING_KEYS = [
  'smtpPassword',
  'apiKey',
  'apiSecret',
  'webhookSecret',
  'slackWebhookUrl',
  'paymentGatewaySecret',
  'smsApiKey',
];

export const SECRET_MASK = '••••••••';

export const DEFAULT_PLATFORM_SETTINGS = {
  appName: 'InsightBooks',
  supportEmail: 'support@insightbooksafrica.com',
  defaultCurrency: 'MWK',
  timezone: 'Africa/Blantyre',
  sessionTimeout: 480,
  maxLoginAttempts: 5,
  allowedIPs: '',
  smtpHost: '',
  smtpPort: 465,
  smtpUsername: '',
  smtpPassword: '',
  fromEmail: 'InsightBooks <noreply@insightbooksafrica.com>',
  welcomeEmailTemplate: '',
  passwordResetTemplate: '',
  adminNotificationEmail: 'admin@insightbooksafrica.com',
  slackWebhookUrl: '',
  apiKey: '',
  apiSecret: '',
  dbPoolSize: 10,
  queryTimeout: 30,
  cacheTTL: 15,
  rateLimit: 100,
};

export const DEFAULT_FEATURE_FLAGS = {
  twoFactorAuth: false,
  passwordComplexity: true,
  ipWhitelist: false,
  systemAlerts: true,
  securityNotifications: true,
  dailyReports: false,
  dbLogging: false,
  apiCaching: true,
  userRegistration: true,
  advancedAnalytics: false,
  multiTenancy: true,
  apiAccess: false,
  auditLogging: true,
  maintenanceMode: false,
};

export function isSecretKey(key) {
  return SECRET_SETTING_KEYS.includes(key);
}

export function isSecretSet(value) {
  if (value == null) return false;
  const s = String(value);
  if (!s || s === SECRET_MASK) return false;
  return true;
}

/**
 * Return a public copy of settings with secrets masked (never raw).
 */
export function maskSettingsForClient(settings = {}) {
  const out = { ...settings };
  for (const key of SECRET_SETTING_KEYS) {
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      out[key] = isSecretSet(out[key]) ? SECRET_MASK : '';
    }
  }
  return out;
}

/**
 * Merge incoming settings into existing.
 * Empty / masked secret fields keep the existing stored value.
 */
export function mergeSettings(existing = {}, incoming = {}) {
  const next = { ...existing };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (isSecretKey(key)) {
      if (value == null || value === '' || value === SECRET_MASK) {
        continue; // keep existing
      }
      next[key] = String(value);
      continue;
    }
    next[key] = value;
  }
  return next;
}
