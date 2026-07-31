import { coerceLocale, DEFAULT_LOCALE } from './locales.js';

/** Sync JSON imports for bundlers — explicit map keeps tree-shaking predictable. */
import enCommon from '../../locales/en/common.json';
import enNavigation from '../../locales/en/navigation.json';
import enAuthentication from '../../locales/en/authentication.json';
import enValidation from '../../locales/en/validation.json';
import enErrors from '../../locales/en/errors.json';
import enAccessibility from '../../locales/en/accessibility.json';
import enSettings from '../../locales/en/settings.json';
import enDashboard from '../../locales/en/dashboard.json';
import enAccounting from '../../locales/en/accounting.json';
import enReversals from '../../locales/en/reversals.json';
import enTax from '../../locales/en/tax-management.json';
import enSales from '../../locales/en/sales.json';
import enPurchases from '../../locales/en/purchases.json';
import enExpenses from '../../locales/en/expenses.json';
import enInventory from '../../locales/en/inventory.json';
import enAssets from '../../locales/en/assets-liabilities.json';
import enRental from '../../locales/en/rental-hiring.json';
import enHr from '../../locales/en/hr-payroll.json';
import enBanking from '../../locales/en/banking.json';
import enBudgets from '../../locales/en/budgets-forecasts.json';
import enReports from '../../locales/en/reports.json';
import enDocuments from '../../locales/en/documents.json';
import enNotifications from '../../locales/en/notifications.json';
import enEmails from '../../locales/en/emails.json';
import enImports from '../../locales/en/imports-exports.json';
import enAdmin from '../../locales/en/administration.json';
import enAdminShell from '../../locales/en/admin-shell.json';
import enAdminFoundation from '../../locales/en/admin-foundation.json';
import enAdminPages from '../../locales/en/admin-pages.json';

import nyCommon from '../../locales/ny/common.json';
import nyNavigation from '../../locales/ny/navigation.json';
import nyAuthentication from '../../locales/ny/authentication.json';
import nyValidation from '../../locales/ny/validation.json';
import nyErrors from '../../locales/ny/errors.json';
import nyAccessibility from '../../locales/ny/accessibility.json';
import nySettings from '../../locales/ny/settings.json';
import nyDashboard from '../../locales/ny/dashboard.json';
import nyAccounting from '../../locales/ny/accounting.json';
import nyReversals from '../../locales/ny/reversals.json';
import nyTax from '../../locales/ny/tax-management.json';
import nySales from '../../locales/ny/sales.json';
import nyPurchases from '../../locales/ny/purchases.json';
import nyExpenses from '../../locales/ny/expenses.json';
import nyInventory from '../../locales/ny/inventory.json';
import nyAssets from '../../locales/ny/assets-liabilities.json';
import nyRental from '../../locales/ny/rental-hiring.json';
import nyHr from '../../locales/ny/hr-payroll.json';
import nyBanking from '../../locales/ny/banking.json';
import nyBudgets from '../../locales/ny/budgets-forecasts.json';
import nyReports from '../../locales/ny/reports.json';
import nyDocuments from '../../locales/ny/documents.json';
import nyNotifications from '../../locales/ny/notifications.json';
import nyEmails from '../../locales/ny/emails.json';
import nyImports from '../../locales/ny/imports-exports.json';
import nyAdmin from '../../locales/ny/administration.json';
import nyAdminShell from '../../locales/ny/admin-shell.json';
import nyAdminFoundation from '../../locales/ny/admin-foundation.json';
import nyAdminPages from '../../locales/ny/admin-pages.json';

const CATALOGUES = {
  en: {
    common: enCommon,
    navigation: enNavigation,
    authentication: enAuthentication,
    validation: enValidation,
    errors: enErrors,
    accessibility: enAccessibility,
    settings: enSettings,
    dashboard: enDashboard,
    accounting: enAccounting,
    reversals: enReversals,
    'tax-management': enTax,
    sales: enSales,
    purchases: enPurchases,
    expenses: enExpenses,
    inventory: enInventory,
    'assets-liabilities': enAssets,
    'rental-hiring': enRental,
    'hr-payroll': enHr,
    banking: enBanking,
    'budgets-forecasts': enBudgets,
    reports: enReports,
    documents: enDocuments,
    notifications: enNotifications,
    emails: enEmails,
    'imports-exports': enImports,
    administration: enAdmin,
    'admin-shell': enAdminShell,
    'admin-foundation': enAdminFoundation,
    'admin-pages': enAdminPages,
  },
  ny: {
    common: nyCommon,
    navigation: nyNavigation,
    authentication: nyAuthentication,
    validation: nyValidation,
    errors: nyErrors,
    accessibility: nyAccessibility,
    settings: nySettings,
    dashboard: nyDashboard,
    accounting: nyAccounting,
    reversals: nyReversals,
    'tax-management': nyTax,
    sales: nySales,
    purchases: nyPurchases,
    expenses: nyExpenses,
    inventory: nyInventory,
    'assets-liabilities': nyAssets,
    'rental-hiring': nyRental,
    'hr-payroll': nyHr,
    banking: nyBanking,
    'budgets-forecasts': nyBudgets,
    reports: nyReports,
    documents: nyDocuments,
    notifications: nyNotifications,
    emails: nyEmails,
    'imports-exports': nyImports,
    administration: nyAdmin,
    'admin-shell': nyAdminShell,
    'admin-foundation': nyAdminFoundation,
    'admin-pages': nyAdminPages,
  },
};

export const ALL_NAMESPACES = Object.keys(CATALOGUES.en);

function flattenNamespace(ns, obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && v.one == null && v.other == null) {
      Object.assign(out, flattenNamespace(ns, v, key));
    } else {
      out[`${ns}.${key}`] = v;
    }
  }
  return out;
}

/** Merge selected namespaces into a flat key map: namespace.key → value */
export function loadMessages(locale, namespaces = ALL_NAMESPACES) {
  const loc = coerceLocale(locale);
  const pack = CATALOGUES[loc] || CATALOGUES[DEFAULT_LOCALE];
  const enPack = CATALOGUES[DEFAULT_LOCALE];
  const merged = {};
  for (const ns of namespaces) {
    const dict = pack[ns] || enPack[ns] || {};
    Object.assign(merged, flattenNamespace(ns, dict));
  }
  return merged;
}

export function loadAllLocaleMessages() {
  return {
    en: loadMessages('en'),
    ny: loadMessages('ny'),
  };
}
