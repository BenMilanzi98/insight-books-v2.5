'use client';

import { useState, useMemo, useCallback } from 'react';
import { formatYmdInTimeZone } from '@/lib/dateUtils';

/**
 * Shared report timeframe + custom / single-day date pickers (matches /reports behavior).
 */
export function useReportTimeframe(initialTimeframe = 'thisMonth') {
  const [timeframe, setTimeframe] = useState(initialTimeframe);
  const [customDateRange, setCustomDateRange] = useState({ startDate: '', endDate: '' });
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [showSingleDayPicker, setShowSingleDayPicker] = useState(false);
  const [singleDayPickerDate, setSingleDayPickerDate] = useState(() =>
    formatYmdInTimeZone(new Date())
  );

  const customRangeForApi = useMemo(() => {
    if (timeframe === 'singleDay') {
      const d = customDateRange?.startDate || customDateRange?.endDate;
      return d ? { startDate: d, endDate: d } : null;
    }
    if (timeframe === 'custom' && customDateRange?.startDate && customDateRange?.endDate) {
      return customDateRange;
    }
    return null;
  }, [timeframe, customDateRange]);

  const needsDateRangeSelection =
    (timeframe === 'custom' || timeframe === 'singleDay') && !customRangeForApi;

  const handleCustomDateRangeChange = useCallback((field, value) => {
    setCustomDateRange((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleTimeframeChange = useCallback(
    (value) => {
      if (value === 'custom') {
        setCustomDateRange({ startDate: '', endDate: '' });
        setShowCustomDateRange(true);
        return;
      }
      if (value === 'singleDay') {
        const d =
          customDateRange?.startDate &&
          customDateRange?.endDate &&
          customDateRange.startDate === customDateRange.endDate
            ? customDateRange.startDate
            : formatYmdInTimeZone(new Date());
        setSingleDayPickerDate(d);
        setCustomDateRange({ startDate: d, endDate: d });
        setTimeframe('singleDay');
        setShowSingleDayPicker(true);
        return;
      }
      setTimeframe(value);
    },
    [customDateRange]
  );

  const applyCustomDateRange = useCallback(() => {
    if (!customDateRange.startDate || !customDateRange.endDate) {
      return { ok: false, error: 'Please select both start and end dates' };
    }
    if (new Date(customDateRange.startDate) > new Date(customDateRange.endDate)) {
      return { ok: false, error: 'Start date cannot be after end date' };
    }
    setTimeframe('custom');
    setShowCustomDateRange(false);
    return { ok: true };
  }, [customDateRange]);

  const applySingleDayPicker = useCallback(() => {
    if (!singleDayPickerDate?.trim()) {
      return { ok: false, error: 'Please select a date' };
    }
    const d = singleDayPickerDate.trim();
    setCustomDateRange({ startDate: d, endDate: d });
    setTimeframe('singleDay');
    setShowSingleDayPicker(false);
    return { ok: true };
  }, [singleDayPickerDate]);

  const resetTimeframe = useCallback(() => {
    setTimeframe(initialTimeframe);
    setCustomDateRange({ startDate: '', endDate: '' });
    setShowCustomDateRange(false);
    setShowSingleDayPicker(false);
  }, [initialTimeframe]);

  return {
    timeframe,
    setTimeframe,
    customDateRange,
    customRangeForApi,
    needsDateRangeSelection,
    showCustomDateRange,
    setShowCustomDateRange,
    showSingleDayPicker,
    setShowSingleDayPicker,
    singleDayPickerDate,
    setSingleDayPickerDate,
    handleTimeframeChange,
    handleCustomDateRangeChange,
    applyCustomDateRange,
    applySingleDayPicker,
    resetTimeframe,
  };
}
