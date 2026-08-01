// app/services/trialBalanceService.js

/**
 * Client service for Trial Balance — Accounting V2 canonical generate/export.
 * Legacy /api/reports/trial-balance returns 410 Gone.
 */
import { calculateDateRange } from '@/lib/dateUtils';

const amountToNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  if (typeof value === 'object' && value.decimal != null) return Number(value.decimal) || 0;
  return Number(value) || 0;
};

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Map V2 Trial Balance envelope → shape expected by /trial-balance page.
 */
function mapV2EnvelopeToLegacyShape(envelope) {
  const lines = Array.isArray(envelope?.lines) ? envelope.lines : [];
  const accounts = lines.map((line) => {
    const closingDebit = amountToNumber(line.closingDebit);
    const closingCredit = amountToNumber(line.closingCredit);
    return {
      id: line.accountId,
      accountId: line.accountId,
      code: line.accountCode,
      accountCode: line.accountCode,
      name: line.accountName,
      accountName: line.accountName,
      type: line.accountType || line.category || null,
      accountType: line.accountType || null,
      isHeader: Boolean(line.isHeader),
      // Legacy UI shows a single debit/credit pair — use closing balances.
      debit: closingDebit,
      credit: closingCredit,
      openingDebit: amountToNumber(line.openingDebit),
      openingCredit: amountToNumber(line.openingCredit),
      periodDebit: amountToNumber(line.periodDebit),
      periodCredit: amountToNumber(line.periodCredit),
      warningStatus: line.warningStatus || null,
    };
  });

  return {
    accounts,
    totals: envelope?.totals || null,
    trialBalanceStatus: envelope?.trialBalanceStatus || null,
    integrityStatus: envelope?.integrityStatus || null,
    integrityWarnings: envelope?.integrityWarnings || [],
    byTenant: null,
    consolidation: null,
    source: 'accounting-v2',
  };
}

/**
 * Fetch trial balance data for a specific timeframe
 * @param {string} timeframe - Timeframe identifier (e.g., 'thisMonth', 'lastMonth', 'custom')
 * @param {Object} [customRange] - For timeframe 'custom': { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 * @param {{ mode: string, tenantIds: string[] }} [businessScope] - unused; V2 scopes from session
 * @returns {Promise<Object>} Trial balance data
 */
export const fetchTrialBalance = async (timeframe = 'thisMonth', customRange = null, businessScope = null) => {
  try {
    const { startDate, endDate } = calculateDateRange(timeframe, false, customRange);
    const fromDate = formatDate(startDate);
    const toDate = formatDate(endDate);

    const queryParams = new URLSearchParams({
      type: 'TRIAL_BALANCE',
      fromDate,
      toDate,
      asOfDate: toDate,
    });
    // businessScope is session-derived on V2 routes; keep param for call-site compatibility
    void businessScope;

    const response = await fetch(`/api/accounting-v2/reports/generate?${queryParams.toString()}`);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || payload.message || `Error fetching trial balance: ${response.statusText}`);
    }

    return mapV2EnvelopeToLegacyShape(payload);
  } catch (error) {
    console.error('Error fetching trial balance:', error);
    throw error;
  }
};

/**
 * Export trial balance data via Accounting V2 export
 * @param {string} timeframe - Timeframe identifier
 * @param {string} format - Export format (csv, pdf, excel, xlsx)
 * @param {Object} [customRange] - For timeframe 'custom': { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 * @param {{ mode: string, tenantIds: string[] }} [businessScope]
 * @returns {Promise<Blob>} Exported data as blob
 */
export const exportTrialBalance = async (
  timeframe = 'thisMonth',
  format = 'pdf',
  customRange = null,
  businessScope = null
) => {
  try {
    const { startDate, endDate } = calculateDateRange(timeframe, false, customRange);
    const fromDate = formatDate(startDate);
    const toDate = formatDate(endDate);
    const normalizedFormat = String(format || 'pdf').toLowerCase() === 'excel' ? 'xlsx' : String(format || 'pdf').toLowerCase();

    const queryParams = new URLSearchParams({
      type: 'TRIAL_BALANCE',
      format: normalizedFormat,
      fromDate,
      toDate,
      asOfDate: toDate,
    });
    void businessScope;

    const response = await fetch(`/api/accounting-v2/reports/export?${queryParams.toString()}`);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || payload.message || `Error exporting trial balance: ${response.statusText}`);
    }

    return await response.blob();
  } catch (error) {
    console.error('Error exporting trial balance:', error);
    throw error;
  }
};

/**
 * Create a new journal entry
 * @param {Object} journalEntryData - Journal entry data
 * @returns {Promise<Object>} Created journal entry
 */
export const createJournalEntry = async (journalEntryData) => {
  try {
    const response = await fetch('/api/journal-entries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(journalEntryData),
    });

    if (!response.ok) {
      throw new Error(`Error creating journal entry: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating journal entry:', error);
    throw error;
  }
};
