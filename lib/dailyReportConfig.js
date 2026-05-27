/**
 * Daily Report Configuration
 * 
 * This file contains all configuration options for the daily report system.
 * Modify these settings to customize the daily report behavior.
 */

// Report Schedule Configuration
export const REPORT_SCHEDULE = {
  // Time when daily reports should be sent (24-hour format)
  HOUR: 20, // 8:00 PM
  MINUTE: 0,
  
  // Timezone for scheduling (use IANA timezone identifier)
  TIMEZONE: 'Africa/Blantyre', // Malawi timezone
  
  // Days of the week when reports should be sent (0 = Sunday, 1 = Monday, etc.)
  // Set to null to send every day
  DAYS_OF_WEEK: null, // null = every day, [1,2,3,4,5] = Monday to Friday only
  
  // Whether to send reports on weekends
  INCLUDE_WEEKENDS: true
};

// Email Configuration
export const EMAIL_CONFIG = {
  // Subject line template
  SUBJECT_TEMPLATE: 'Daily Financial Report - {companyName} - {date}',
  
  // From email address
  FROM_EMAIL: process.env.EMAIL_FROM || 'insightbooks@iplusplay.com',
  FROM_NAME: 'InsightBooks Daily Reports',
  
  // Reply-to email
  REPLY_TO: 'support@insightbooks.com',
  
  // Email priority (high, normal, low)
  PRIORITY: 'normal',
  
  // Whether to include HTML and text versions
  INCLUDE_HTML: true,
  INCLUDE_TEXT: true
};

// Report Content Configuration
export const REPORT_CONTENT = {
  // Include sales breakdown (POS vs Invoices)
  INCLUDE_SALES_BREAKDOWN: true,
  
  // Include expense categories
  INCLUDE_EXPENSE_CATEGORIES: true,
  
  // Include tax information
  INCLUDE_TAX_INFO: true,
  
  // Include outstanding invoices
  INCLUDE_OUTSTANDING_INVOICES: true,
  
  // Include profit margin calculation
  INCLUDE_PROFIT_MARGIN: true,
  
  // Currency formatting
  CURRENCY: 'MWK',
  CURRENCY_LOCALE: 'en-MW',
  
  // Date formatting
  DATE_FORMAT: {
    locale: 'en-US',
    options: {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }
  }
};

// Data Aggregation Configuration
export const DATA_CONFIG = {
  // Sales statuses to include in calculations
  VALID_SALES_STATUSES: ['completed'],
  
  // Invoice statuses to include in calculations
  VALID_INVOICE_STATUSES: ['Paid', 'Pending'],
  
  // Expense statuses to include in calculations
  VALID_EXPENSE_STATUSES: ['Approved', 'Pending'],
  
  // Whether to include voided/refunded transactions
  INCLUDE_VOIDED_TRANSACTIONS: false,
  
  // Whether to include draft invoices
  INCLUDE_DRAFT_INVOICES: false
};

// Admin User Configuration
export const ADMIN_CONFIG = {
  // Role name for master admins
  MASTER_ADMIN_ROLE: 'Admin',
  
  // Whether to send reports to inactive users
  INCLUDE_INACTIVE_USERS: false,
  
  // Whether to require email verification
  REQUIRE_EMAIL_VERIFICATION: true,
  
  // Maximum number of admins to process per batch
  MAX_ADMINS_PER_BATCH: 50,
  
  // Delay between email sends (in milliseconds)
  EMAIL_DELAY_MS: 1000
};

// Error Handling Configuration
export const ERROR_CONFIG = {
  // Maximum retry attempts for failed emails
  MAX_RETRY_ATTEMPTS: 3,
  
  // Retry delay between attempts (in milliseconds)
  RETRY_DELAY_MS: 5000,
  
  // Whether to continue processing if some emails fail
  CONTINUE_ON_ERROR: true,
  
  // Log level for error reporting
  LOG_LEVEL: 'info' // 'debug', 'info', 'warn', 'error'
};

// Performance Configuration
export const PERFORMANCE_CONFIG = {
  // Database query timeout (in milliseconds)
  DB_TIMEOUT_MS: 30000,
  
  // Maximum concurrent database queries
  MAX_CONCURRENT_QUERIES: 5,
  
  // Whether to use database connection pooling
  USE_CONNECTION_POOLING: true,
  
  // Cache duration for admin user list (in milliseconds)
  ADMIN_CACHE_DURATION_MS: 300000 // 5 minutes
};

// Security Configuration
export const SECURITY_CONFIG = {
  // Required API key for cron job access
  CRON_SECRET_ENV_VAR: 'CRON_SECRET',
  
  // Minimum API key length
  MIN_SECRET_LENGTH: 32,
  
  // Rate limiting for manual triggers
  MAX_MANUAL_TRIGGERS_PER_HOUR: 10,
  
  // IP whitelist for cron job access (optional)
  ALLOWED_IPS: null, // null = no IP restriction
};

// Notification Configuration
export const NOTIFICATION_CONFIG = {
  // Whether to send success notifications
  SEND_SUCCESS_NOTIFICATIONS: true,
  
  // Whether to send failure notifications
  SEND_FAILURE_NOTIFICATIONS: true,
  
  // Notification recipients (comma-separated emails)
  NOTIFICATION_RECIPIENTS: process.env.DAILY_REPORT_NOTIFICATIONS || '',
  
  // Notification email template
  NOTIFICATION_SUBJECT: 'Daily Report Processing Summary - {date}'
};

// Export all configurations
export const DAILY_REPORT_CONFIG = {
  schedule: REPORT_SCHEDULE,
  email: EMAIL_CONFIG,
  content: REPORT_CONTENT,
  data: DATA_CONFIG,
  admin: ADMIN_CONFIG,
  error: ERROR_CONFIG,
  performance: PERFORMANCE_CONFIG,
  security: SECURITY_CONFIG,
  notifications: NOTIFICATION_CONFIG
};

// Helper function to get configuration value
export function getConfig(path) {
  const keys = path.split('.');
  let value = DAILY_REPORT_CONFIG;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

// Helper function to format currency
export function formatCurrency(amount) {
  return new Intl.NumberFormat(
    REPORT_CONTENT.CURRENCY_LOCALE,
    {
      style: 'currency',
      currency: REPORT_CONTENT.CURRENCY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ).format(amount).replace(REPORT_CONTENT.CURRENCY, REPORT_CONTENT.CURRENCY);
}

// Helper function to format date
export function formatDate(date) {
  return new Date(date).toLocaleDateString(
    REPORT_CONTENT.DATE_FORMAT.locale,
    REPORT_CONTENT.DATE_FORMAT.options
  );
} 