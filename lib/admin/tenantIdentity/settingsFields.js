/** Safe TenantSettings keys allowed in identity packages (no EIS secrets). */
export const SAFE_TENANT_SETTINGS_KEYS = [
  'taxEnabled',
  'defaultTaxRate',
  'currencyCode',
  'invoicePrefix',
  'invoiceTemplate',
  'enabledModules',
  'customDomain',
  'dailyReports',
  'emailFooter',
  'emailNotifications',
  'inAppNotifications',
  'invoiceReminders',
  'lowStockAlerts',
  'monthlyReports',
  'paymentReceipts',
  'smsNotifications',
  'weeklyReports',
  'buildingName',
  'businessAddress',
  'businessCity',
  'businessEmail',
  'businessPhone',
  'receiptFooter',
  'receiptPaperWidthMm',
  'defaultBankDetails',
  'npsEmployeeRatePercent',
  'npsEmployerRatePercent',
  'balanceReminderSubject',
  'balanceReminderBody',
  'taxInflowAccountId',
  'taxOutflowAccountId',
  'ownerContributedCapital',
  'capitalSetupCompletedAt',
  'paymentAccountsSetupCompletedAt',
  'fiscalYearStartMonth',
  'openingBalancesAsOfDate',
  'setupReminderSnoozedUntil',
  'setupWizardState',
  'expiryWarnDaysEarly',
  'expiryWarnDaysUrgent',
  'inventoryAdjustmentLossAccountId',
  'reversalRequireSeparateApprover',
  // v2.5-only (ignored on v2.0 import if column missing)
  'defaultLanguage',
  'payrollAccountMappings',
  'rentalPostInvoiceOnBook',
  'rentalAutoCompleteExpired',
  'rentalLegacyBookingEnabled',
];

export const OMITTED_SETTINGS_KEYS = ['eisApiKey', 'eisClientSecret'];

export function pickSafeSettings(settings) {
  if (!settings || typeof settings !== 'object') return null;
  const out = {};
  for (const key of SAFE_TENANT_SETTINGS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(settings, key) && settings[key] !== undefined) {
      out[key] = settings[key];
    }
  }
  return out;
}
