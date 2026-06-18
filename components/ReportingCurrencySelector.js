'use client';

import { useCallback, useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import {
  readReportingCurrencyFromStorage,
  REPORTING_CURRENCY_OPTIONS,
  writeReportingCurrencyToStorage,
} from '@/lib/businessScopeStorage';

/**
 * Group reporting currency for multi-business consolidated reports.
 * Only shown when multiple businesses are in scope.
 *
 * @param {object} props
 * @param {string|null} props.value - Selected ISO currency code, or null for primary tenant default
 * @param {(code: string|null) => void} props.onChange
 * @param {boolean} [props.visible]
 * @param {string} [props.className]
 */
export default function ReportingCurrencySelector({
  value,
  onChange,
  visible = true,
  className = '',
}) {
  if (!visible) return null;

  return (
    <div className={`relative ${className}`}>
      <Coins
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
        aria-hidden
      />
      <select
        className="w-full appearance-none pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label="Reporting currency for consolidated reports"
      >
        <option value="">Primary business currency</option>
        {REPORTING_CURRENCY_OPTIONS.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Persisted reporting currency preference for multi-business scope.
 */
export function useReportingCurrency() {
  const [reportingCurrency, setReportingCurrencyState] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setReportingCurrencyState(readReportingCurrencyFromStorage());
    setHydrated(true);
  }, []);

  const setReportingCurrency = useCallback((code) => {
    const normalized = code ? String(code).trim().toUpperCase() : null;
    setReportingCurrencyState(normalized);
    writeReportingCurrencyToStorage(normalized);
  }, []);

  return { reportingCurrency, setReportingCurrency, hydrated };
}
